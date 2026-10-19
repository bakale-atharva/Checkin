import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    selectedFreeListingId: v.optional(v.id("listings")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_created_at", ["createdAt"]),
  listings: defineTable({
    ownerProfileId: v.id("users"),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    title: v.string(),
    description: v.string(),
    propertyType: v.union(
      v.literal("entire_home"),
      v.literal("private_room"),
      v.literal("shared_room"),
    ),
    category: v.string(),
    maxGuests: v.number(),
    bedrooms: v.number(),
    beds: v.number(),
    bathrooms: v.number(),
    amenities: v.array(v.string()),
    rules: v.array(v.string()),
    privateAddress: v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      region: v.optional(v.string()),
      postalCode: v.string(),
      countryCode: v.string(),
    }),
    publicLocation: v.object({
      city: v.string(),
      region: v.optional(v.string()),
      countryCode: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    timezone: v.string(),
    checkInTime: v.string(),
    checkOutTime: v.string(),
    nightlyPriceCents: v.number(),
    cleaningFeeCents: v.number(),
    currency: v.literal("USD"),
    bookingMode: v.union(v.literal("instant"), v.literal("request")),
    searchCity: v.optional(v.string()),
    searchCountryCode: v.optional(v.string()),
    publishedRating: v.optional(v.number()),
    seedKey: v.optional(v.string()),
    coverPhotoId: v.optional(v.id("listingPhotos")),
    publishedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    bookingSuspended: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_profile_id", ["ownerProfileId"])
    .index("by_owner_profile_id_and_status", ["ownerProfileId", "status"])
    .index("by_status", ["status"])
    .index("by_status_and_search_city", ["status", "searchCity"])
    .index("by_status_and_created_at", ["status", "createdAt"])
    .index("by_seed_key", ["seedKey"]),
  listingPhotos: defineTable({
    listingId: v.id("listings"),
    // Exactly one source: a host upload, or a direct link for seeded demo data.
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    altText: v.optional(v.string()),
    position: v.number(),
    createdAt: v.number(),
  }).index("by_listing_id_and_position", ["listingId", "position"]),
  pendingListingPhotoUploads: defineTable({
    listingId: v.id("listings"),
    ownerProfileId: v.id("users"),
    storageId: v.id("_storage"),
    status: v.literal("pending"),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_listing_id", ["listingId"])
    .index("by_status_and_expires_at", ["status", "expiresAt"]),
  blockedDates: defineTable({
    listingId: v.id("listings"),
    date: v.string(),
    createdAt: v.number(),
  })
    .index("by_listing_id", ["listingId"])
    .index("by_listing_id_and_date", ["listingId", "date"]),
  nightlyPriceOverrides: defineTable({
    listingId: v.id("listings"),
    date: v.string(),
    nightlyPriceCents: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing_id", ["listingId"])
    .index("by_listing_id_and_date", ["listingId", "date"]),
  billingSubscriptions: defineTable({
    clerkSubscriptionId: v.string(),
    clerkUserId: v.string(),
    planSlug: v.string(),
    status: v.string(),
    effectiveUntil: v.union(v.number(), v.null()),
    lastEventAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_subscription_id", ["clerkSubscriptionId"])
    .index("by_clerk_user_id_and_updated_at", ["clerkUserId", "updatedAt"]),
  billingWebhookEvents: defineTable({
    clerkEventId: v.string(),
    receivedAt: v.number(),
  }).index("by_clerk_event_id", ["clerkEventId"]),
  searchSnapshots: defineTable({
    total: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_expires_at", ["expiresAt"]),
  searchSnapshotResults: defineTable({
    snapshotId: v.id("searchSnapshots"),
    position: v.number(),
    listingId: v.id("listings"),
    title: v.string(),
    city: v.string(),
    region: v.optional(v.string()),
    countryCode: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    nightlyPriceCents: v.number(),
    publishedRating: v.number(),
    maxGuests: v.number(),
    category: v.string(),
    propertyType: v.union(
      v.literal("entire_home"),
      v.literal("private_room"),
      v.literal("shared_room"),
    ),
    amenities: v.array(v.string()),
    bookingMode: v.union(v.literal("instant"), v.literal("request")),
    coverPhotoId: v.optional(v.id("listingPhotos")),
  }).index("by_snapshot_id_and_position", ["snapshotId", "position"]),
  reservationQuotes: defineTable({
    listingId: v.id("listings"),
    guestProfileId: v.id("users"),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    expiresAt: v.number(),
    quote: v.object({
      nightlyCharges: v.array(
        v.object({ date: v.string(), amountCents: v.number() }),
      ),
      accommodationCents: v.number(),
      cleaningFeeCents: v.number(),
      serviceFeeCents: v.number(),
      taxCents: v.number(),
      totalCents: v.number(),
      hostProceedsCents: v.number(),
      checkInAt: v.string(),
      checkOutAt: v.string(),
      cancellationDeadline: v.string(),
    }),
    createdAt: v.number(),
  })
    .index("by_guest_profile_id_and_expires_at", [
      "guestProfileId",
      "expiresAt",
    ])
    .index("by_expires_at", ["expiresAt"]),
  reservations: defineTable({
    listingId: v.id("listings"),
    guestProfileId: v.id("users"),
    hostProfileId: v.id("users"),
    quoteId: v.id("reservationQuotes"),
    idempotencyKey: v.string(),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    bookingMode: v.union(v.literal("instant"), v.literal("request")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("completed"),
      v.literal("declined"),
      v.literal("expired"),
    ),
    paymentStatus: v.union(
      v.literal("not_required"),
      v.literal("hold"),
      v.literal("paid"),
      v.literal("declined"),
      v.literal("refunded"),
      v.literal("refund_failed"),
    ),
    paymentHoldExpiresAt: v.optional(v.number()),
    requestExpiresAt: v.optional(v.number()),
    checkInAt: v.string(),
    checkOutAt: v.string(),
    cancellationDeadline: v.string(),
    quote: v.object({
      nightlyCharges: v.array(
        v.object({ date: v.string(), amountCents: v.number() }),
      ),
      accommodationCents: v.number(),
      cleaningFeeCents: v.number(),
      serviceFeeCents: v.number(),
      taxCents: v.number(),
      totalCents: v.number(),
      hostProceedsCents: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_guest_profile_id_and_idempotency_key", [
      "guestProfileId",
      "idempotencyKey",
    ])
    .index("by_guest_profile_id_and_created_at", [
      "guestProfileId",
      "createdAt",
    ])
    .index("by_host_profile_id_and_created_at", ["hostProfileId", "createdAt"])
    .index("by_host_profile_id_and_status_and_created_at", [
      "hostProfileId",
      "status",
      "createdAt",
    ])
    .index("by_status_and_check_out", ["status", "checkOut"])
    .index("by_status_and_payment_hold_expires_at", [
      "status",
      "paymentHoldExpiresAt",
    ])
    .index("by_status_and_request_expires_at", ["status", "requestExpiresAt"]),
  reservationNights: defineTable({
    reservationId: v.id("reservations"),
    listingId: v.id("listings"),
    date: v.string(),
    createdAt: v.number(),
  })
    .index("by_listing_id_and_date", ["listingId", "date"])
    .index("by_reservation_id", ["reservationId"]),
  paymentOperations: defineTable({
    reservationId: v.id("reservations"),
    kind: v.union(v.literal("charge"), v.literal("refund")),
    idempotencyKey: v.string(),
    amountCents: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("succeeded"),
      v.literal("declined"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reservation_id", ["reservationId"])
    .index("by_reservation_id_and_idempotency_key", [
      "reservationId",
      "idempotencyKey",
    ])
    .index("by_status_and_updated_at", ["status", "updatedAt"]),
  paymentSimulationScenarios: defineTable({
    reservationId: v.id("reservations"),
    kind: v.union(v.literal("charge"), v.literal("refund")),
    outcome: v.union(
      v.literal("success"),
      v.literal("decline"),
      v.literal("delay"),
      v.literal("refund_failure"),
    ),
    delayMs: v.number(),
    updatedAt: v.number(),
  }).index("by_reservation_id_and_kind", ["reservationId", "kind"]),
  lateCancellationRequests: defineTable({
    reservationId: v.id("reservations"),
    guestProfileId: v.id("users"),
    reason: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved")),
    resolution: v.optional(
      v.union(v.literal("refund_approved"), v.literal("declined")),
    ),
    resolutionNote: v.optional(v.string()),
    resolvedByProfileId: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_reservation_id", ["reservationId"])
    .index("by_status_and_created_at", ["status", "createdAt"]),
  wishlists: defineTable({
    ownerProfileId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_profile_id_and_updated_at", [
    "ownerProfileId",
    "updatedAt",
  ]),
  wishlistItems: defineTable({
    wishlistId: v.id("wishlists"),
    listingId: v.id("listings"),
    createdAt: v.number(),
  })
    .index("by_wishlist_id_and_created_at", ["wishlistId", "createdAt"])
    .index("by_wishlist_id_and_listing_id", ["wishlistId", "listingId"]),
  conversations: defineTable({
    reservationId: v.id("reservations"),
    guestProfileId: v.id("users"),
    hostProfileId: v.id("users"),
    latestMessageAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_reservation_id", ["reservationId"]),
  conversationParticipants: defineTable({
    conversationId: v.id("conversations"),
    profileId: v.id("users"),
    lastReadAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_conversation_id_and_profile_id", ["conversationId", "profileId"])
    .index("by_profile_id_and_updated_at", ["profileId", "updatedAt"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderProfileId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_conversation_id_and_created_at", [
    "conversationId",
    "createdAt",
  ]),
  messageRateLimits: defineTable({
    profileId: v.id("users"),
    windowStartedAt: v.number(),
    sentCount: v.number(),
  }).index("by_profile_id", ["profileId"]),
  notifications: defineTable({
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
  }).index("by_profile_id_and_created_at", ["profileId", "createdAt"]),
  reviews: defineTable({
    reservationId: v.id("reservations"),
    listingId: v.id("listings"),
    reviewerProfileId: v.id("users"),
    recipientProfileId: v.id("users"),
    kind: v.union(v.literal("guest_to_host"), v.literal("host_to_guest")),
    guestRatings: v.optional(
      v.object({
        overall: v.number(),
        cleanliness: v.number(),
        accuracy: v.number(),
        checkIn: v.number(),
        communication: v.number(),
        location: v.number(),
        value: v.number(),
      }),
    ),
    hostRatings: v.optional(
      v.object({
        communication: v.number(),
        cleanliness: v.number(),
        ruleObservance: v.number(),
      }),
    ),
    comment: v.optional(v.string()),
    submittedAt: v.number(),
    revealedAt: v.optional(v.number()),
  })
    .index("by_reservation_id_and_reviewer_profile_id", [
      "reservationId",
      "reviewerProfileId",
    ])
    .index("by_reservation_id", ["reservationId"])
    .index("by_listing_id_and_kind_and_revealed_at", [
      "listingId",
      "kind",
      "revealedAt",
    ])
    .index("by_revealed_at_and_submitted_at", ["revealedAt", "submittedAt"]),
  reviewAggregates: defineTable({
    listingId: v.id("listings"),
    count: v.number(),
    overallTotal: v.number(),
    cleanlinessTotal: v.number(),
    accuracyTotal: v.number(),
    checkInTotal: v.number(),
    communicationTotal: v.number(),
    locationTotal: v.number(),
    valueTotal: v.number(),
    updatedAt: v.number(),
  }).index("by_listing_id", ["listingId"]),
  simulatedPayouts: defineTable({
    reservationId: v.id("reservations"),
    hostProfileId: v.id("users"),
    amountCents: v.number(),
    status: v.literal("paid"),
    paidAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_reservation_id", ["reservationId"])
    .index("by_host_profile_id_and_paid_at", ["hostProfileId", "paidAt"]),
  operationalEvents: defineTable({
    dedupeKey: v.string(),
    kind: v.union(
      v.literal("scheduled_function_failed"),
      v.literal("payment_operation_abandoned"),
      v.literal("refund_failed"),
      v.literal("refund_stalled"),
      v.literal("late_cancellation_requested"),
      v.literal("missed_transition_repaired"),
    ),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
    ),
    message: v.string(),
    reservationId: v.optional(v.id("reservations")),
    paymentOperationId: v.optional(v.id("paymentOperations")),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    status: v.union(v.literal("open"), v.literal("resolved")),
    resolutionNote: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_status_and_created_at", ["status", "createdAt"])
    .index("by_reservation_id", ["reservationId"]),
});
