import { ConvexError, v } from "convex/values";

import {
  publicationAllowance,
  selectFreeListing,
} from "../lib/billing/host-plan-policy";
import { authorizationError, AuthorizationErrorCode } from "../lib/auth/authorization";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireProfile } from "./auth";

const MAX_PUBLISHED_LISTINGS_SCAN = 100;

const billingSubscriptionValidator = v.object({
  _id: v.id("billingSubscriptions"),
  _creationTime: v.number(),
  clerkSubscriptionId: v.string(),
  clerkUserId: v.string(),
  planSlug: v.string(),
  status: v.string(),
  effectiveUntil: v.union(v.number(), v.null()),
  lastEventAt: v.number(),
  updatedAt: v.number(),
});

async function suspendExcessPublishedListings(
  ctx: MutationCtx,
  clerkUserId: string,
  subscription: { planSlug: string; status: string; effectiveUntil: number | null },
  now: number,
) {
  const profile = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
  if (!profile) return;

  // Publishing is capped at the Host Pro allowance, so this bound covers every published listing.
  // (A mutation may run only one paginated query, so a paginate loop is not an option here.)
  const published = await ctx.db
    .query("listings")
    .withIndex("by_owner_profile_id_and_status", (q) =>
      q.eq("ownerProfileId", profile._id).eq("status", "published"),
    )
    .take(MAX_PUBLISHED_LISTINGS_SCAN);
  const allowance = publicationAllowance(subscription, now);
  if (allowance > 1) {
    await Promise.all(
      published.map((listing) =>
        ctx.db.patch(listing._id, { bookingSuspended: false, updatedAt: now }),
      ),
    );
    return;
  }
  if (published.length <= 1) return;

  const keepId = selectFreeListing(
    published.map((listing) => ({
      id: listing._id,
      publishedAt: listing.publishedAt ?? listing._creationTime,
    })),
    profile.selectedFreeListingId ?? null,
  );
  await Promise.all(
    published.map((listing) =>
      ctx.db.patch(listing._id, { bookingSuspended: listing._id !== keepId, updatedAt: now }),
    ),
  );
}

export const recordSubscriptionWebhook = internalMutation({
  args: {
    clerkEventId: v.string(),
    clerkSubscriptionId: v.string(),
    clerkUserId: v.string(),
    planSlug: v.string(),
    status: v.string(),
    effectiveUntil: v.union(v.number(), v.null()),
    occurredAt: v.number(),
    isSubscriptionItem: v.boolean(),
  },
  returns: v.object({ processed: v.boolean() }),
  handler: async (ctx, args): Promise<{ processed: boolean }> => {
    const priorEvent = await ctx.db
      .query("billingWebhookEvents")
      .withIndex("by_clerk_event_id", (q) => q.eq("clerkEventId", args.clerkEventId))
      .unique();
    if (priorEvent) return { processed: false };

    await ctx.db.insert("billingWebhookEvents", {
      clerkEventId: args.clerkEventId,
      receivedAt: Date.now(),
    });
    let current = await ctx.db
      .query("billingSubscriptions")
      .withIndex("by_clerk_subscription_id", (q) =>
        q.eq("clerkSubscriptionId", args.clerkSubscriptionId),
      )
      .unique();
    if (!current && args.isSubscriptionItem) {
      const subscriptions = await ctx.db
        .query("billingSubscriptions")
        .withIndex("by_clerk_user_id_and_updated_at", (q) =>
          q.eq("clerkUserId", args.clerkUserId),
        )
        .take(10);
      current =
        subscriptions.find((subscription) => subscription.planSlug === args.planSlug) ??
        subscriptions[0] ??
        null;
    }
    if (current && current.lastEventAt > args.occurredAt) return { processed: false };

    const now = Date.now();
    const subscription = {
      clerkSubscriptionId: current?.clerkSubscriptionId ?? args.clerkSubscriptionId,
      clerkUserId: args.clerkUserId,
      planSlug: args.planSlug,
      status: args.status,
      effectiveUntil: args.effectiveUntil,
      lastEventAt: args.occurredAt,
      updatedAt: now,
    };
    if (current) await ctx.db.patch(current._id, subscription);
    else await ctx.db.insert("billingSubscriptions", subscription);
    await suspendExcessPublishedListings(ctx, args.clerkUserId, subscription, now);
    return { processed: true };
  },
});

export const selectFreeListingForDowngrade = mutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.ownerProfileId !== profile._id || listing.status !== "published") {
      throw new ConvexError(authorizationError(AuthorizationErrorCode.Forbidden));
    }
    await ctx.db.patch(profile._id, {
      selectedFreeListingId: listing._id,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const ingestSubscriptionWebhook = mutation({
  args: {
    ingestSecret: v.string(),
    clerkEventId: v.string(),
    clerkSubscriptionId: v.string(),
    clerkUserId: v.string(),
    planSlug: v.string(),
    status: v.string(),
    effectiveUntil: v.union(v.number(), v.null()),
    occurredAt: v.number(),
    isSubscriptionItem: v.boolean(),
  },
  returns: v.object({ processed: v.boolean() }),
  handler: async (ctx, args): Promise<{ processed: boolean }> => {
    const expectedSecret = process.env.CLERK_BILLING_INGEST_SECRET;
    if (!expectedSecret || args.ingestSecret !== expectedSecret) {
      throw new ConvexError(authorizationError(AuthorizationErrorCode.Forbidden));
    }
    return await ctx.runMutation(internal.billing.recordSubscriptionWebhook, {
      clerkEventId: args.clerkEventId,
      clerkSubscriptionId: args.clerkSubscriptionId,
      clerkUserId: args.clerkUserId,
      planSlug: args.planSlug,
      status: args.status,
      effectiveUntil: args.effectiveUntil,
      occurredAt: args.occurredAt,
      isSubscriptionItem: args.isSubscriptionItem,
    });
  },
});

export const currentHostSubscription = query({
  args: {},
  returns: v.union(billingSubscriptionValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError(authorizationError(AuthorizationErrorCode.Unauthenticated));
    }
    const profile = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!profile) return null;
    const subscriptions = await ctx.db
      .query("billingSubscriptions")
      .withIndex("by_clerk_user_id_and_updated_at", (q) => q.eq("clerkUserId", profile.clerkUserId))
      .order("desc")
      .take(10);
    return subscriptions[0] ?? null;
  },
});
