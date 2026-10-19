import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import {
  isConversationUnread,
  MessageRateLimitError,
  nextMessageRateLimit,
} from "../lib/messaging/message-policy";
import {
  areValidRatings,
  GUEST_RATING_KEYS,
  HOST_RATING_KEYS,
  REVIEW_WINDOW_MS,
  shouldRevealReviews,
} from "../lib/reviews/review-policy";
import { assertProfileOwner, requireProfile } from "./auth";
import { listingPhotoUrl } from "./photoSources";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_WISHLIST_ITEMS = 100;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_CALENDAR_DAYS = 366;
const MAX_UNREAD_SCAN = 100;
const MAX_SAVED_LOOKUP = 500;

const messageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  senderProfileId: v.id("users"),
  body: v.string(),
  createdAt: v.number(),
});

const notificationValidator = v.object({
  _id: v.id("notifications"),
  _creationTime: v.number(),
  profileId: v.id("users"),
  kind: v.union(
    v.literal("reservation_action"),
    v.literal("review_eligible"),
    v.literal("message"),
  ),
  reservationId: v.optional(v.id("reservations")),
  conversationId: v.optional(v.id("conversations")),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
});

const guestRatingsValidator = v.object({
  overall: v.number(),
  cleanliness: v.number(),
  accuracy: v.number(),
  checkIn: v.number(),
  communication: v.number(),
  location: v.number(),
  value: v.number(),
});
const hostRatingsValidator = v.object({
  communication: v.number(),
  cleanliness: v.number(),
  ruleObservance: v.number(),
});

function dashboardError(code: string, message: string) {
  return new ConvexError({ code, message });
}

function assertRatings(
  ratings: Record<string, number>,
  keys: readonly string[],
) {
  if (!areValidRatings(ratings, keys)) {
    throw dashboardError(
      "INVALID_RATING",
      "Ratings must be whole numbers from one through five.",
    );
  }
}

async function requireWishlistOwner(
  ctx: QueryCtx | MutationCtx,
  wishlistId: Id<"wishlists">,
) {
  const profile = await requireProfile(ctx);
  const wishlist = await ctx.db.get(wishlistId);
  if (!wishlist)
    throw dashboardError("WISHLIST_NOT_FOUND", "Wishlist not found.");
  assertProfileOwner(wishlist.ownerProfileId, profile._id);
  return { profile, wishlist };
}

async function coverPhotoUrl(ctx: QueryCtx, listing: Doc<"listings">) {
  const photo = listing.coverPhotoId
    ? await ctx.db.get(listing.coverPhotoId)
    : null;
  return photo ? await listingPhotoUrl(ctx, photo) : null;
}

async function currentProfileOrNull(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

async function requireConversationParticipant(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
) {
  const profile = await requireProfile(ctx);
  const participant = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation_id_and_profile_id", (q) =>
      q.eq("conversationId", conversationId).eq("profileId", profile._id),
    )
    .unique();
  if (!participant)
    throw dashboardError(
      "CONVERSATION_FORBIDDEN",
      "You are not a participant in this conversation.",
    );
  return { profile, participant };
}

async function revealReview(
  ctx: MutationCtx,
  review: Doc<"reviews">,
  now: number,
) {
  if (review.revealedAt !== undefined) return;
  await ctx.db.patch(review._id, { revealedAt: now });
  if (!review.guestRatings) return;

  const aggregate = await ctx.db
    .query("reviewAggregates")
    .withIndex("by_listing_id", (q) => q.eq("listingId", review.listingId))
    .unique();
  const ratings = review.guestRatings;
  const next = {
    count: (aggregate?.count ?? 0) + 1,
    overallTotal: (aggregate?.overallTotal ?? 0) + ratings.overall,
    cleanlinessTotal: (aggregate?.cleanlinessTotal ?? 0) + ratings.cleanliness,
    accuracyTotal: (aggregate?.accuracyTotal ?? 0) + ratings.accuracy,
    checkInTotal: (aggregate?.checkInTotal ?? 0) + ratings.checkIn,
    communicationTotal:
      (aggregate?.communicationTotal ?? 0) + ratings.communication,
    locationTotal: (aggregate?.locationTotal ?? 0) + ratings.location,
    valueTotal: (aggregate?.valueTotal ?? 0) + ratings.value,
    updatedAt: now,
  };
  if (aggregate) await ctx.db.patch(aggregate._id, next);
  else
    await ctx.db.insert("reviewAggregates", {
      listingId: review.listingId,
      ...next,
    });
  await ctx.db.patch(review.listingId, {
    publishedRating: next.overallTotal / next.count,
    updatedAt: now,
  });
}

async function revealReservationReviews(
  ctx: MutationCtx,
  reservation: Doc<"reservations">,
  now: number,
) {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_reservation_id", (q) =>
      q.eq("reservationId", reservation._id),
    )
    .take(2);
  const reviewDeadlineAt =
    Date.parse(reservation.checkOutAt) + REVIEW_WINDOW_MS;
  if (
    !shouldRevealReviews({
      now,
      reviewDeadlineAt,
      submittedReviews: reviews.length,
    })
  )
    return false;
  await Promise.all(reviews.map((review) => revealReview(ctx, review, now)));
  return true;
}

export const listWishlists = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const wishlists = await ctx.db
      .query("wishlists")
      .withIndex("by_owner_profile_id_and_updated_at", (q) =>
        q.eq("ownerProfileId", profile._id),
      )
      .order("desc")
      .take(100);
    return await Promise.all(
      wishlists.map(async (wishlist) => {
        const items = await ctx.db
          .query("wishlistItems")
          .withIndex("by_wishlist_id_and_created_at", (q) =>
            q.eq("wishlistId", wishlist._id),
          )
          .take(MAX_WISHLIST_ITEMS + 1);
        return {
          ...wishlist,
          itemCount: Math.min(items.length, MAX_WISHLIST_ITEMS),
        };
      }),
    );
  },
});

export const listWishlistItems = query({
  args: {
    wishlistId: v.id("wishlists"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(v.any()),
  handler: async (ctx, args) => {
    await requireWishlistOwner(ctx, args.wishlistId);
    const result = await ctx.db
      .query("wishlistItems")
      .withIndex("by_wishlist_id_and_created_at", (q) =>
        q.eq("wishlistId", args.wishlistId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (item) => {
          const listing = await ctx.db.get(item.listingId);
          return listing
            ? {
                ...item,
                listing: {
                  id: listing._id,
                  title: listing.title,
                  city: listing.publicLocation.city,
                  region: listing.publicLocation.region,
                  nightlyPriceCents: listing.nightlyPriceCents,
                  publishedRating: listing.publishedRating,
                  coverPhotoId: listing.coverPhotoId,
                  coverPhotoUrl: await coverPhotoUrl(ctx, listing),
                },
              }
            : null;
        }),
      ).then((items) =>
        items.filter((item): item is NonNullable<typeof item> => item !== null),
      ),
    };
  },
});

/**
 * Which of the given listings the viewer has saved to any wishlist. Signed-out
 * viewers get an empty list so discovery stays public.
 */
export const savedListingIds = query({
  args: { listingIds: v.array(v.id("listings")) },
  returns: v.array(v.id("listings")),
  handler: async (ctx, args) => {
    if (args.listingIds.length > MAX_SAVED_LOOKUP)
      throw dashboardError(
        "TOO_MANY_LISTINGS",
        `Check at most ${MAX_SAVED_LOOKUP} listings at once.`,
      );
    const profile = await currentProfileOrNull(ctx);
    if (!profile || args.listingIds.length === 0) return [];
    const wanted = new Set<string>(args.listingIds);
    const wishlists = await ctx.db
      .query("wishlists")
      .withIndex("by_owner_profile_id_and_updated_at", (q) =>
        q.eq("ownerProfileId", profile._id),
      )
      .take(100);
    const saved = new Set<Id<"listings">>();
    await Promise.all(
      wishlists.map(async (wishlist) => {
        const items = await ctx.db
          .query("wishlistItems")
          .withIndex("by_wishlist_id_and_created_at", (q) =>
            q.eq("wishlistId", wishlist._id),
          )
          .take(MAX_WISHLIST_ITEMS);
        for (const item of items)
          if (wanted.has(item.listingId)) saved.add(item.listingId);
      }),
    );
    return [...saved];
  },
});

/** The viewer's wishlists, each marked with whether it contains the listing. */
export const listingWishlists = query({
  args: { listingId: v.id("listings") },
  returns: v.array(
    v.object({
      wishlistId: v.id("wishlists"),
      name: v.string(),
      containsListing: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const wishlists = await ctx.db
      .query("wishlists")
      .withIndex("by_owner_profile_id_and_updated_at", (q) =>
        q.eq("ownerProfileId", profile._id),
      )
      .order("desc")
      .take(100);
    return await Promise.all(
      wishlists.map(async (wishlist) => {
        const item = await ctx.db
          .query("wishlistItems")
          .withIndex("by_wishlist_id_and_listing_id", (q) =>
            q.eq("wishlistId", wishlist._id).eq("listingId", args.listingId),
          )
          .unique();
        return {
          wishlistId: wishlist._id,
          name: wishlist.name,
          containsListing: item !== null,
        };
      }),
    );
  },
});

export const createWishlist = mutation({
  args: { name: v.string() },
  returns: v.id("wishlists"),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const name = args.name.trim();
    if (!name || name.length > 80)
      throw dashboardError(
        "INVALID_WISHLIST",
        "Wishlist names must be 1–80 characters.",
      );
    const now = Date.now();
    return await ctx.db.insert("wishlists", {
      ownerProfileId: profile._id,
      name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const renameWishlist = mutation({
  args: { wishlistId: v.id("wishlists"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wishlist } = await requireWishlistOwner(ctx, args.wishlistId);
    const name = args.name.trim();
    if (!name || name.length > 80)
      throw dashboardError(
        "INVALID_WISHLIST",
        "Wishlist names must be 1–80 characters.",
      );
    await ctx.db.patch(wishlist._id, { name, updatedAt: Date.now() });
    return null;
  },
});

export const deleteWishlist = mutation({
  args: { wishlistId: v.id("wishlists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wishlist } = await requireWishlistOwner(ctx, args.wishlistId);
    const items = await ctx.db
      .query("wishlistItems")
      .withIndex("by_wishlist_id_and_created_at", (q) =>
        q.eq("wishlistId", wishlist._id),
      )
      .take(MAX_WISHLIST_ITEMS + 1);
    if (items.length > MAX_WISHLIST_ITEMS)
      throw dashboardError(
        "WISHLIST_TOO_LARGE",
        "Wishlist has too many items to delete at once.",
      );
    await Promise.all(items.map((item) => ctx.db.delete(item._id)));
    await ctx.db.delete(wishlist._id);
    return null;
  },
});

export const addWishlistItem = mutation({
  args: { wishlistId: v.id("wishlists"), listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wishlist } = await requireWishlistOwner(ctx, args.wishlistId);
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.status !== "published")
      throw dashboardError("LISTING_NOT_FOUND", "Published listing not found.");
    const existing = await ctx.db
      .query("wishlistItems")
      .withIndex("by_wishlist_id_and_listing_id", (q) =>
        q.eq("wishlistId", wishlist._id).eq("listingId", listing._id),
      )
      .unique();
    if (existing) return null;
    const items = await ctx.db
      .query("wishlistItems")
      .withIndex("by_wishlist_id_and_created_at", (q) =>
        q.eq("wishlistId", wishlist._id),
      )
      .take(MAX_WISHLIST_ITEMS + 1);
    if (items.length >= MAX_WISHLIST_ITEMS)
      throw dashboardError(
        "WISHLIST_FULL",
        "Wishlists can contain at most 100 properties.",
      );
    const now = Date.now();
    await ctx.db.insert("wishlistItems", {
      wishlistId: wishlist._id,
      listingId: listing._id,
      createdAt: now,
    });
    await ctx.db.patch(wishlist._id, { updatedAt: now });
    return null;
  },
});

export const removeWishlistItem = mutation({
  args: { wishlistId: v.id("wishlists"), listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wishlist } = await requireWishlistOwner(ctx, args.wishlistId);
    const item = await ctx.db
      .query("wishlistItems")
      .withIndex("by_wishlist_id_and_listing_id", (q) =>
        q.eq("wishlistId", wishlist._id).eq("listingId", args.listingId),
      )
      .unique();
    if (item) {
      await ctx.db.delete(item._id);
      await ctx.db.patch(wishlist._id, { updatedAt: Date.now() });
    }
    return null;
  },
});

export const guestTrips = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.any()),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const result = await ctx.db
      .query("reservations")
      .withIndex("by_guest_profile_id_and_created_at", (q) =>
        q.eq("guestProfileId", profile._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (reservation) => {
          const listing = await ctx.db.get(reservation.listingId);
          return {
            reservation,
            listing: listing && {
              id: listing._id,
              title: listing.title,
              city: listing.publicLocation.city,
              region: listing.publicLocation.region,
              coverPhotoId: listing.coverPhotoId,
            },
          };
        }),
      ),
    };
  },
});

export const hostBookingRequests = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.any()),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const result = await ctx.db
      .query("reservations")
      .withIndex("by_host_profile_id_and_status_and_created_at", (q) =>
        q.eq("hostProfileId", profile._id).eq("status", "pending"),
      )
      // Pending instant bookings are payment holds, not requests awaiting a host decision.
      .filter((q) => q.eq(q.field("bookingMode"), "request"))
      .order("desc")
      .paginate(args.paginationOpts);
    return result;
  },
});

export const hostCalendar = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    listingId: v.optional(v.id("listings")),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.startDate >= args.endDate)
      throw dashboardError(
        "INVALID_DATE_RANGE",
        "Calendar end date must be after start date.",
      );
    const span =
      (Date.parse(`${args.endDate}T00:00:00Z`) -
        Date.parse(`${args.startDate}T00:00:00Z`)) /
      86_400_000;
    if (!Number.isInteger(span) || span > MAX_CALENDAR_DAYS)
      throw dashboardError(
        "INVALID_DATE_RANGE",
        "Calendars are limited to one year.",
      );
    const profile = await requireProfile(ctx);
    const listings = args.listingId
      ? [await ctx.db.get(args.listingId)]
      : await ctx.db
          .query("listings")
          .withIndex("by_owner_profile_id", (q) =>
            q.eq("ownerProfileId", profile._id),
          )
          .take(10);
    const owned = listings.filter(
      (listing): listing is NonNullable<typeof listing> =>
        !!listing && listing.ownerProfileId === profile._id,
    );
    if (args.listingId && owned.length === 0)
      throw dashboardError("LISTING_FORBIDDEN", "Listing not found.");
    const [nights, blocked] = await Promise.all([
      Promise.all(
        owned.map((listing) =>
          ctx.db
            .query("reservationNights")
            .withIndex("by_listing_id_and_date", (q) =>
              q
                .eq("listingId", listing._id)
                .gte("date", args.startDate)
                .lt("date", args.endDate),
            )
            .take(MAX_CALENDAR_DAYS),
        ),
      ),
      Promise.all(
        owned.map((listing) =>
          ctx.db
            .query("blockedDates")
            .withIndex("by_listing_id_and_date", (q) =>
              q
                .eq("listingId", listing._id)
                .gte("date", args.startDate)
                .lt("date", args.endDate),
            )
            .take(MAX_CALENDAR_DAYS),
        ),
      ),
    ]);
    const reserved = await Promise.all(
      nights.flat().map(async (night) => {
        const reservation = await ctx.db.get(night.reservationId);
        return (
          reservation && {
            kind: "reservation" as const,
            listingId: night.listingId,
            date: night.date,
            reservationId: reservation._id,
            status: reservation.status,
          }
        );
      }),
    ).then((items) =>
      items.filter((item): item is NonNullable<typeof item> => !!item),
    );
    return [
      ...reserved,
      ...blocked.flat().map((day) => ({
        kind: "blocked" as const,
        listingId: day.listingId,
        date: day.date,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const hostDashboard = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const [reservations, payouts, subscription] = await Promise.all([
      ctx.db
        .query("reservations")
        .withIndex("by_host_profile_id_and_created_at", (q) =>
          q.eq("hostProfileId", profile._id),
        )
        .order("desc")
        .take(500),
      ctx.db
        .query("simulatedPayouts")
        .withIndex("by_host_profile_id_and_paid_at", (q) =>
          q.eq("hostProfileId", profile._id),
        )
        .order("desc")
        .take(500),
      ctx.db
        .query("billingSubscriptions")
        .withIndex("by_clerk_user_id_and_updated_at", (q) =>
          q.eq("clerkUserId", profile.clerkUserId),
        )
        .order("desc")
        .take(1),
    ]);
    const sumProceeds = (rows: Doc<"reservations">[]) =>
      rows.reduce(
        (total, reservation) => total + reservation.quote.hostProceedsCents,
        0,
      );
    const confirmed = reservations.filter(
      (reservation) => reservation.status === "confirmed",
    );
    const refunded = reservations.filter(
      (reservation) => reservation.paymentStatus === "refunded",
    );
    return {
      subscription: subscription[0] ?? null,
      bookings: {
        pendingRequests: reservations.filter(
          (reservation) =>
            reservation.status === "pending" &&
            reservation.bookingMode === "request",
        ).length,
        confirmed: confirmed.length,
        completed: reservations.filter(
          (reservation) => reservation.status === "completed",
        ).length,
        cancelled: reservations.filter(
          (reservation) => reservation.status === "cancelled",
        ).length,
      },
      // All figures are simulated and derived from booking snapshots, so they reconcile with reservations.
      simulatedEarnings: {
        paidOutCents: payouts.reduce(
          (total, payout) => total + payout.amountCents,
          0,
        ),
        upcomingCents: sumProceeds(confirmed),
        refundedGuestTotalCents: refunded.reduce(
          (total, reservation) => total + reservation.quote.totalCents,
          0,
        ),
        refundFailures: reservations.filter(
          (reservation) => reservation.paymentStatus === "refund_failed",
        ).length,
      },
      payoutCount: payouts.length,
      truncated: reservations.length === 500 || payouts.length === 500,
    };
  },
});

export const payoutHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.any()),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    return await ctx.db
      .query("simulatedPayouts")
      .withIndex("by_host_profile_id_and_paid_at", (q) =>
        q.eq("hostProfileId", profile._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getOrCreateReservationConversation = mutation({
  args: { reservationId: v.id("reservations") },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const reservation = await ctx.db.get(args.reservationId);
    if (
      !reservation ||
      (reservation.guestProfileId !== profile._id &&
        reservation.hostProfileId !== profile._id)
    ) {
      throw dashboardError("RESERVATION_FORBIDDEN", "Reservation not found.");
    }
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_reservation_id", (q) =>
        q.eq("reservationId", reservation._id),
      )
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      reservationId: reservation._id,
      guestProfileId: reservation.guestProfileId,
      hostProfileId: reservation.hostProfileId,
      createdAt: now,
    });
    await Promise.all(
      [reservation.guestProfileId, reservation.hostProfileId].map((profileId) =>
        ctx.db.insert("conversationParticipants", {
          conversationId,
          profileId,
          updatedAt: now,
        }),
      ),
    );
    return conversationId;
  },
});

export const conversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(messageValidator),
  handler: async (ctx, args) => {
    await requireConversationParticipant(ctx, args.conversationId);
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation_id_and_created_at", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const sendMessage = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const { profile, participant } = await requireConversationParticipant(
      ctx,
      args.conversationId,
    );
    const body = args.body.trim();
    if (!body || body.length > MAX_MESSAGE_LENGTH)
      throw dashboardError(
        "INVALID_MESSAGE",
        "Messages must be 1–2,000 characters.",
      );
    const now = Date.now();
    const rateLimit = await ctx.db
      .query("messageRateLimits")
      .withIndex("by_profile_id", (q) => q.eq("profileId", profile._id))
      .unique();
    let nextRateLimit;
    try {
      nextRateLimit = nextMessageRateLimit(rateLimit, now);
    } catch (error) {
      if (error instanceof MessageRateLimitError)
        throw dashboardError("MESSAGE_RATE_LIMITED", error.message);
      throw error;
    }
    if (rateLimit) await ctx.db.patch(rateLimit._id, nextRateLimit);
    else
      await ctx.db.insert("messageRateLimits", {
        profileId: profile._id,
        ...nextRateLimit,
      });
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation)
      throw dashboardError("CONVERSATION_NOT_FOUND", "Conversation not found.");
    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderProfileId: profile._id,
      body,
      createdAt: now,
    });
    const participants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation_id_and_profile_id", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .take(2);
    await ctx.db.patch(conversation._id, { latestMessageAt: now });
    await Promise.all(
      participants.map(async (current) => {
        await ctx.db.patch(current._id, {
          updatedAt: now,
          ...(current._id === participant._id ? { lastReadAt: now } : {}),
        });
        if (current.profileId !== profile._id) {
          await ctx.db.insert("notifications", {
            profileId: current.profileId,
            kind: "message",
            conversationId: conversation._id,
            reservationId: conversation.reservationId,
            createdAt: now,
          });
        }
      }),
    );
    return messageId;
  },
});

export const markConversationRead = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { participant } = await requireConversationParticipant(
      ctx,
      args.conversationId,
    );
    const now = Date.now();
    await ctx.db.patch(participant._id, { lastReadAt: now, updatedAt: now });
    return null;
  },
});

export const inbox = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.any()),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const result = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_profile_id_and_updated_at", (q) =>
        q.eq("profileId", profile._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (participant) => {
          const conversation = await ctx.db.get(participant.conversationId);
          if (!conversation) return null;
          const otherProfileId =
            conversation.guestProfileId === profile._id
              ? conversation.hostProfileId
              : conversation.guestProfileId;
          const otherProfile = await ctx.db.get(otherProfileId);
          return {
            conversationId: conversation._id,
            reservationId: conversation.reservationId,
            latestMessageAt: conversation.latestMessageAt,
            lastReadAt: participant.lastReadAt,
            unread: isConversationUnread(
              conversation.latestMessageAt,
              participant.lastReadAt,
            ),
            participant: otherProfile && {
              id: otherProfile._id,
              name: otherProfile.name,
              imageUrl: otherProfile.imageUrl,
            },
          };
        }),
      ).then((items) =>
        items.filter((item): item is NonNullable<typeof item> => !!item),
      ),
    };
  },
});

export const notifications = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(notificationValidator),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_profile_id_and_created_at", (q) =>
        q.eq("profileId", profile._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.profileId !== profile._id)
      throw dashboardError("NOTIFICATION_FORBIDDEN", "Notification not found.");
    await ctx.db.patch(notification._id, { readAt: Date.now() });
    return null;
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_profile_id_and_created_at", (q) =>
        q.eq("profileId", profile._id),
      )
      .order("desc")
      .take(MAX_UNREAD_SCAN);
    const unread = recent.filter(
      (notification) => notification.readAt === undefined,
    );
    const now = Date.now();
    await Promise.all(
      unread.map((notification) =>
        ctx.db.patch(notification._id, { readAt: now }),
      ),
    );
    return unread.length;
  },
});

export const unreadSummary = query({
  args: {},
  returns: v.object({
    notifications: v.number(),
    conversations: v.number(),
    capped: v.boolean(),
  }),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const [recentNotifications, participants] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_profile_id_and_created_at", (q) =>
          q.eq("profileId", profile._id),
        )
        .order("desc")
        .take(MAX_UNREAD_SCAN),
      ctx.db
        .query("conversationParticipants")
        .withIndex("by_profile_id_and_updated_at", (q) =>
          q.eq("profileId", profile._id),
        )
        .order("desc")
        .take(MAX_UNREAD_SCAN),
    ]);
    const conversations = await Promise.all(
      participants.map((participant) => ctx.db.get(participant.conversationId)),
    );
    return {
      notifications: recentNotifications.filter(
        (notification) => notification.readAt === undefined,
      ).length,
      conversations: participants.filter((participant, index) =>
        isConversationUnread(
          conversations[index]?.latestMessageAt,
          participant.lastReadAt,
        ),
      ).length,
      capped:
        recentNotifications.length === MAX_UNREAD_SCAN ||
        participants.length === MAX_UNREAD_SCAN,
    };
  },
});

export const submitReview = mutation({
  args: {
    reservationId: v.id("reservations"),
    guestRatings: v.optional(guestRatingsValidator),
    hostRatings: v.optional(hostRatingsValidator),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "completed")
      throw dashboardError(
        "REVIEW_NOT_ELIGIBLE",
        "Completed reservation not found.",
      );
    const now = Date.now();
    if (now > Date.parse(reservation.checkOutAt) + REVIEW_WINDOW_MS)
      throw dashboardError(
        "REVIEW_WINDOW_CLOSED",
        "The review window has closed.",
      );
    const isGuest = reservation.guestProfileId === profile._id;
    const isHost = reservation.hostProfileId === profile._id;
    if (!isGuest && !isHost)
      throw dashboardError(
        "REVIEW_FORBIDDEN",
        "You are not a reservation participant.",
      );
    if (
      (isGuest && (!args.guestRatings || args.hostRatings)) ||
      (isHost && (!args.hostRatings || args.guestRatings))
    ) {
      throw dashboardError(
        "INVALID_REVIEW",
        "Submit the ratings appropriate to your reservation role.",
      );
    }
    if (args.guestRatings) assertRatings(args.guestRatings, GUEST_RATING_KEYS);
    if (args.hostRatings) assertRatings(args.hostRatings, HOST_RATING_KEYS);
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_reservation_id_and_reviewer_profile_id", (q) =>
        q
          .eq("reservationId", reservation._id)
          .eq("reviewerProfileId", profile._id),
      )
      .unique();
    if (existing)
      throw dashboardError(
        "REVIEW_ALREADY_SUBMITTED",
        "You have already submitted a review.",
      );
    const comment = args.comment?.trim();
    if (comment !== undefined && comment.length > 2_000)
      throw dashboardError(
        "INVALID_REVIEW",
        "Review comments must be at most 2,000 characters.",
      );
    await ctx.db.insert("reviews", {
      reservationId: reservation._id,
      listingId: reservation.listingId,
      reviewerProfileId: profile._id,
      recipientProfileId: isGuest
        ? reservation.hostProfileId
        : reservation.guestProfileId,
      kind: isGuest ? "guest_to_host" : "host_to_guest",
      ...(args.guestRatings
        ? { guestRatings: args.guestRatings }
        : { hostRatings: args.hostRatings! }),
      ...(comment ? { comment } : {}),
      submittedAt: now,
    });
    await revealReservationReviews(ctx, reservation, now);
    return null;
  },
});

export const revealReviewsAfterDeadline = internalMutation({
  args: { reservationId: v.id("reservations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "completed") return false;
    return await revealReservationReviews(ctx, reservation, Date.now());
  },
});

export const reservationReviewStatus = query({
  args: { reservationId: v.id("reservations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const reservation = await ctx.db.get(args.reservationId);
    if (
      !reservation ||
      (reservation.guestProfileId !== profile._id &&
        reservation.hostProfileId !== profile._id)
    ) {
      throw dashboardError("RESERVATION_FORBIDDEN", "Reservation not found.");
    }
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_reservation_id", (q) =>
        q.eq("reservationId", reservation._id),
      )
      .take(2);
    const mine =
      reviews.find((review) => review.reviewerProfileId === profile._id) ??
      null;
    const theirs =
      reviews.find((review) => review.reviewerProfileId !== profile._id) ??
      null;
    return {
      eligible: reservation.status === "completed",
      role: reservation.guestProfileId === profile._id ? "guest" : "host",
      reviewDeadlineAt: Date.parse(reservation.checkOutAt) + REVIEW_WINDOW_MS,
      mine,
      counterpartSubmitted: theirs !== null,
      // The counterpart's content stays hidden until the reveal.
      counterpart: theirs?.revealedAt !== undefined ? theirs : null,
    };
  },
});

export const publishedReviews = query({
  args: {
    listingId: v.id("listings"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(v.any()),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.status !== "published")
      return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("reviews")
      .withIndex("by_listing_id_and_kind_and_revealed_at", (q) =>
        q
          .eq("listingId", listing._id)
          .eq("kind", "guest_to_host")
          .gt("revealedAt", 0),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((review) => ({
        id: review._id,
        guestRatings: review.guestRatings,
        comment: review.comment,
        submittedAt: review.submittedAt,
      })),
    };
  },
});
