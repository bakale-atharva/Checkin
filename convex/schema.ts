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
    storageId: v.id("_storage"),
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
});
