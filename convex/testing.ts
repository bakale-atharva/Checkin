import { ConvexError, v } from "convex/values";

import {
  allowsFixtureManagement,
  parseDeploymentRole,
} from "../lib/operations/deployment-role";
import { TEST_IDENTITY_ISSUER } from "../lib/testing/integration-target";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { deleteListingPhotoFile } from "./photoSources";

/**
 * Fixture controls for the dedicated integration-test deployment. Every
 * function is internal and refuses to run unless CHECKIN_DEPLOYMENT_ROLE=test.
 */
const RUN_ID_PATTERN = /^[a-z0-9]{6,32}$/;
const CLEANUP_LIMIT = 200;

function requireFixtureDeployment() {
  if (
    !allowsFixtureManagement(
      parseDeploymentRole(process.env.CHECKIN_DEPLOYMENT_ROLE),
    )
  ) {
    throw new ConvexError({
      code: "FIXTURES_DISABLED",
      message:
        "Fixture management is limited to deployments with CHECKIN_DEPLOYMENT_ROLE=test.",
    });
  }
}

export const deploymentRole = internalQuery({
  args: {},
  returns: v.union(v.literal("test"), v.literal("demo"), v.literal("standard")),
  handler: async () => parseDeploymentRole(process.env.CHECKIN_DEPLOYMENT_ROLE),
});

/** Moves a reservation's clock-driven fields so expiry, completion, and review deadlines can be exercised. */
export const shiftReservationTimes = internalMutation({
  args: {
    reservationId: v.id("reservations"),
    paymentHoldExpiresAt: v.optional(v.number()),
    requestExpiresAt: v.optional(v.number()),
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
    checkInAt: v.optional(v.string()),
    checkOutAt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireFixtureDeployment();
    const { reservationId, ...fields } = args;
    const reservation = await ctx.db.get(reservationId);
    if (!reservation)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Reservation not found.",
      });
    await ctx.db.patch(reservation._id, { ...fields, updatedAt: Date.now() });
    return null;
  },
});

/** Ages a reservation's pending payment operations so stall detection can be exercised. */
export const backdatePaymentOperations = internalMutation({
  args: { reservationId: v.id("reservations"), updatedAt: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    requireFixtureDeployment();
    const operations = await ctx.db
      .query("paymentOperations")
      .withIndex("by_reservation_id", (q) =>
        q.eq("reservationId", args.reservationId),
      )
      .take(20);
    const pending = operations.filter(
      (operation) => operation.status === "pending",
    );
    await Promise.all(
      pending.map((operation) =>
        ctx.db.patch(operation._id, { updatedAt: args.updatedAt }),
      ),
    );
    return pending.length;
  },
});

async function deleteAll<T extends { _id: Id<TableNames> }>(
  ctx: MutationCtx,
  rows: T[],
) {
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  return rows.length;
}

async function deleteReservation(
  ctx: MutationCtx,
  reservation: Doc<"reservations">,
) {
  let deleted = 0;
  const id = reservation._id;
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("reservationNights")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("paymentOperations")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("paymentSimulationScenarios")
      .withIndex("by_reservation_id_and_kind", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("lateCancellationRequests")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("reviews")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("simulatedPayouts")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("operationalEvents")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
      .take(CLEANUP_LIMIT),
  );
  for (const conversation of await ctx.db
    .query("conversations")
    .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
    .take(CLEANUP_LIMIT)) {
    deleted += await deleteAll(
      ctx,
      await ctx.db
        .query("messages")
        .withIndex("by_conversation_id_and_created_at", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .take(CLEANUP_LIMIT),
    );
    deleted += await deleteAll(
      ctx,
      await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation_id_and_profile_id", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .take(CLEANUP_LIMIT),
    );
    await ctx.db.delete(conversation._id);
    deleted += 1;
  }
  if (await ctx.db.get(reservation.quoteId)) {
    await ctx.db.delete(reservation.quoteId);
    deleted += 1;
  }
  await ctx.db.delete(id);
  return deleted + 1;
}

async function deleteListing(ctx: MutationCtx, listing: Doc<"listings">) {
  let deleted = 0;
  const id = listing._id;
  for (const photo of await ctx.db
    .query("listingPhotos")
    .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", id))
    .take(CLEANUP_LIMIT)) {
    await deleteListingPhotoFile(ctx, photo);
    await ctx.db.delete(photo._id);
    deleted += 1;
  }
  for (const upload of await ctx.db
    .query("pendingListingPhotoUploads")
    .withIndex("by_listing_id", (q) => q.eq("listingId", id))
    .take(CLEANUP_LIMIT)) {
    await ctx.storage.delete(upload.storageId);
    await ctx.db.delete(upload._id);
    deleted += 1;
  }
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("blockedDates")
      .withIndex("by_listing_id", (q) => q.eq("listingId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("nightlyPriceOverrides")
      .withIndex("by_listing_id", (q) => q.eq("listingId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("reviewAggregates")
      .withIndex("by_listing_id", (q) => q.eq("listingId", id))
      .take(CLEANUP_LIMIT),
  );
  deleted += await deleteAll(
    ctx,
    await ctx.db
      .query("reservationNights")
      .withIndex("by_listing_id_and_date", (q) => q.eq("listingId", id))
      .take(CLEANUP_LIMIT),
  );
  await ctx.db.delete(id);
  return deleted + 1;
}

/**
 * Deletes every record created by one integration run's identities. The run id
 * scopes deletion to profiles whose tokenIdentifier carries that run's prefix.
 */
export const cleanupRun = internalMutation({
  args: { runId: v.string() },
  returns: v.object({ profiles: v.number(), documents: v.number() }),
  handler: async (ctx, args) => {
    requireFixtureDeployment();
    if (!RUN_ID_PATTERN.test(args.runId)) {
      throw new ConvexError({
        code: "INVALID_RUN_ID",
        message: "Run ids must be 6–32 lowercase letters or digits.",
      });
    }
    const prefix = `${TEST_IDENTITY_ISSUER}|itest_${args.runId}_`;
    const profiles = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.gte("tokenIdentifier", prefix).lt("tokenIdentifier", `${prefix}￿`),
      )
      .take(20);
    let documents = 0;
    for (const profile of profiles) {
      const asGuest = await ctx.db
        .query("reservations")
        .withIndex("by_guest_profile_id_and_created_at", (q) =>
          q.eq("guestProfileId", profile._id),
        )
        .take(CLEANUP_LIMIT);
      const asHost = await ctx.db
        .query("reservations")
        .withIndex("by_host_profile_id_and_created_at", (q) =>
          q.eq("hostProfileId", profile._id),
        )
        .take(CLEANUP_LIMIT);
      const seen = new Set<Id<"reservations">>();
      for (const reservation of [...asGuest, ...asHost]) {
        if (seen.has(reservation._id) || !(await ctx.db.get(reservation._id)))
          continue;
        seen.add(reservation._id);
        documents += await deleteReservation(ctx, reservation);
      }
      documents += await deleteAll(
        ctx,
        await ctx.db
          .query("reservationQuotes")
          .withIndex("by_guest_profile_id_and_expires_at", (q) =>
            q.eq("guestProfileId", profile._id),
          )
          .take(CLEANUP_LIMIT),
      );
      documents += await deleteAll(
        ctx,
        await ctx.db
          .query("notifications")
          .withIndex("by_profile_id_and_created_at", (q) =>
            q.eq("profileId", profile._id),
          )
          .take(CLEANUP_LIMIT),
      );
      documents += await deleteAll(
        ctx,
        await ctx.db
          .query("conversationParticipants")
          .withIndex("by_profile_id_and_updated_at", (q) =>
            q.eq("profileId", profile._id),
          )
          .take(CLEANUP_LIMIT),
      );
      documents += await deleteAll(
        ctx,
        await ctx.db
          .query("messageRateLimits")
          .withIndex("by_profile_id", (q) => q.eq("profileId", profile._id))
          .take(CLEANUP_LIMIT),
      );
      for (const wishlist of await ctx.db
        .query("wishlists")
        .withIndex("by_owner_profile_id_and_updated_at", (q) =>
          q.eq("ownerProfileId", profile._id),
        )
        .take(CLEANUP_LIMIT)) {
        documents += await deleteAll(
          ctx,
          await ctx.db
            .query("wishlistItems")
            .withIndex("by_wishlist_id_and_created_at", (q) =>
              q.eq("wishlistId", wishlist._id),
            )
            .take(CLEANUP_LIMIT),
        );
        await ctx.db.delete(wishlist._id);
        documents += 1;
      }
      for (const listing of await ctx.db
        .query("listings")
        .withIndex("by_owner_profile_id", (q) =>
          q.eq("ownerProfileId", profile._id),
        )
        .take(CLEANUP_LIMIT)) {
        documents += await deleteListing(ctx, listing);
      }
      documents += await deleteAll(
        ctx,
        await ctx.db
          .query("billingSubscriptions")
          .withIndex("by_clerk_user_id_and_updated_at", (q) =>
            q.eq("clerkUserId", profile.clerkUserId),
          )
          .take(CLEANUP_LIMIT),
      );
      await ctx.db.delete(profile._id);
      documents += 1;
    }
    const eventPrefix = `itest_${args.runId}_`;
    documents += await deleteAll(
      ctx,
      await ctx.db
        .query("billingWebhookEvents")
        .withIndex("by_clerk_event_id", (q) =>
          q
            .gte("clerkEventId", eventPrefix)
            .lt("clerkEventId", `${eventPrefix}￿`),
        )
        .take(CLEANUP_LIMIT),
    );
    return { profiles: profiles.length, documents };
  },
});

/** Read-only view of a reservation's settlement state for integration assertions. */
export const inspectReservation = internalQuery({
  args: { reservationId: v.id("reservations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    requireFixtureDeployment();
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) return null;
    const [paymentOperations, nights, payouts, events, supportRequests] =
      await Promise.all([
        ctx.db
          .query("paymentOperations")
          .withIndex("by_reservation_id", (q) =>
            q.eq("reservationId", reservation._id),
          )
          .take(20),
        ctx.db
          .query("reservationNights")
          .withIndex("by_reservation_id", (q) =>
            q.eq("reservationId", reservation._id),
          )
          .take(29),
        ctx.db
          .query("simulatedPayouts")
          .withIndex("by_reservation_id", (q) =>
            q.eq("reservationId", reservation._id),
          )
          .take(5),
        ctx.db
          .query("operationalEvents")
          .withIndex("by_reservation_id", (q) =>
            q.eq("reservationId", reservation._id),
          )
          .take(20),
        ctx.db
          .query("lateCancellationRequests")
          .withIndex("by_reservation_id", (q) =>
            q.eq("reservationId", reservation._id),
          )
          .take(5),
      ]);
    return {
      reservation,
      paymentOperations,
      reservedNights: nights.length,
      payouts,
      events,
      supportRequests,
    };
  },
});
