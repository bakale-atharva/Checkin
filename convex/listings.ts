import { ConvexError, v } from "convex/values";

import {
  ListingErrorCode,
  listingError,
} from "../lib/listings/listing-errors";
import {
  ListingPolicyError,
  assertListingCanBeDeleted,
  assertListingCanBePublished,
  assertListingStatusTransition,
  isValidStayDate,
} from "../lib/listings/listing-policy";
import { publicationAllowance } from "../lib/billing/host-plan-policy";
import { listingSearchFields } from "../lib/search/listing-search-fields";
import { assertProfileOwner, requireProfile } from "./auth";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_LISTING_PHOTOS = 20;
const MAX_LISTING_CALENDAR_DAYS = 366;
const PHOTO_UPLOAD_TTL_MS = 60 * 60 * 1000;

const propertyTypeValidator = v.union(
  v.literal("entire_home"),
  v.literal("private_room"),
  v.literal("shared_room"),
);
const bookingModeValidator = v.union(v.literal("instant"), v.literal("request"));
const listingStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);
const privateAddressValidator = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  region: v.optional(v.string()),
  postalCode: v.string(),
  countryCode: v.string(),
});
const publicLocationValidator = v.object({
  city: v.string(),
  region: v.optional(v.string()),
  countryCode: v.string(),
  latitude: v.number(),
  longitude: v.number(),
});
const listingValidator = v.object({
  _id: v.id("listings"),
  _creationTime: v.number(),
  ownerProfileId: v.id("users"),
  status: listingStatusValidator,
  title: v.string(),
  description: v.string(),
  propertyType: propertyTypeValidator,
  category: v.string(),
  maxGuests: v.number(),
  bedrooms: v.number(),
  beds: v.number(),
  bathrooms: v.number(),
  amenities: v.array(v.string()),
  rules: v.array(v.string()),
  privateAddress: privateAddressValidator,
  publicLocation: publicLocationValidator,
  timezone: v.string(),
  checkInTime: v.string(),
  checkOutTime: v.string(),
  nightlyPriceCents: v.number(),
  cleaningFeeCents: v.number(),
  currency: v.literal("USD"),
  bookingMode: bookingModeValidator,
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
});
const photoValidator = v.object({
  _id: v.id("listingPhotos"),
  _creationTime: v.number(),
  listingId: v.id("listings"),
  storageId: v.id("_storage"),
  altText: v.optional(v.string()),
  position: v.number(),
  createdAt: v.number(),
});
const updateFieldsValidator = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  propertyType: v.optional(propertyTypeValidator),
  category: v.optional(v.string()),
  maxGuests: v.optional(v.number()),
  bedrooms: v.optional(v.number()),
  beds: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  amenities: v.optional(v.array(v.string())),
  rules: v.optional(v.array(v.string())),
  privateAddress: v.optional(privateAddressValidator),
  publicLocation: v.optional(publicLocationValidator),
  timezone: v.optional(v.string()),
  checkInTime: v.optional(v.string()),
  checkOutTime: v.optional(v.string()),
  nightlyPriceCents: v.optional(v.number()),
  cleaningFeeCents: v.optional(v.number()),
  bookingMode: v.optional(bookingModeValidator),
});

function throwInvalidInput() {
  throw new ConvexError(listingError(ListingErrorCode.InvalidInput));
}

function assertListingFields(listing: {
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  publicLocation: { latitude: number; longitude: number };
}) {
  if (
    !Number.isInteger(listing.maxGuests) ||
    listing.maxGuests < 1 ||
    !Number.isInteger(listing.bedrooms) ||
    listing.bedrooms < 0 ||
    !Number.isInteger(listing.beds) ||
    listing.beds < 0 ||
    listing.bathrooms < 0 ||
    !Number.isInteger(listing.nightlyPriceCents) ||
    listing.nightlyPriceCents < 0 ||
    !Number.isInteger(listing.cleaningFeeCents) ||
    listing.cleaningFeeCents < 0 ||
    listing.publicLocation.latitude < -90 ||
    listing.publicLocation.latitude > 90 ||
    listing.publicLocation.longitude < -180 ||
    listing.publicLocation.longitude > 180
  ) {
    throwInvalidInput();
  }
}

function assertPolicy(action: () => void) {
  try {
    action();
  } catch (error) {
    if (error instanceof ListingPolicyError) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidState));
    }
    throw error;
  }
}

async function getOwnedListing(
  ctx: QueryCtx | MutationCtx,
  listingId: Id<"listings">,
) {
  const listing = await ctx.db.get(listingId);
  if (!listing) {
    throw new ConvexError(listingError(ListingErrorCode.NotFound));
  }
  const profile = await requireProfile(ctx);
  assertProfileOwner(listing.ownerProfileId, profile._id);
  return { listing, profile };
}

export const createDraft = mutation({
  args: {},
  returns: listingValidator,
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const now = Date.now();
    const listingId = await ctx.db.insert("listings", {
      ownerProfileId: profile._id,
      status: "draft",
      title: "Untitled stay",
      description: "",
      propertyType: "entire_home",
      category: "",
      maxGuests: 1,
      bedrooms: 0,
      beds: 0,
      bathrooms: 1,
      amenities: [],
      rules: [],
      privateAddress: {
        line1: "",
        city: "",
        postalCode: "",
        countryCode: "",
      },
      publicLocation: {
        city: "",
        countryCode: "",
        latitude: 0,
        longitude: 0,
      },
      timezone: "UTC",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      nightlyPriceCents: 0,
      cleaningFeeCents: 0,
      currency: "USD",
      bookingMode: "instant",
      createdAt: now,
      updatedAt: now,
    });
    const listing = await ctx.db.get(listingId);
    if (!listing) {
      throw new Error("Listing creation failed unexpectedly.");
    }
    return listing;
  },
});

export const update = mutation({
  args: { listingId: v.id("listings"), fields: updateFieldsValidator },
  returns: listingValidator,
  handler: async (ctx, args) => {
    const { listing } = await getOwnedListing(ctx, args.listingId);
    if (listing.status === "archived") {
      throw new ConvexError(listingError(ListingErrorCode.InvalidState));
    }
    const next = { ...listing, ...args.fields };
    assertListingFields(next);
    const updatedAt = Date.now();
    const searchFields = args.fields.publicLocation
      ? listingSearchFields(args.fields.publicLocation)
      : {};
    await ctx.db.patch(listing._id, { ...args.fields, ...searchFields, updatedAt });
    return { ...listing, ...args.fields, ...searchFields, updatedAt };
  },
});

export const setStatus = mutation({
  args: { listingId: v.id("listings"), status: listingStatusValidator },
  returns: listingValidator,
  handler: async (ctx, args) => {
    const { listing, profile } = await getOwnedListing(ctx, args.listingId);
    assertPolicy(() => assertListingStatusTransition(listing.status, args.status));

    if (args.status === "published") {
      assertPolicy(() => assertListingCanBePublished(listing));
      const photos = await ctx.db
        .query("listingPhotos")
        .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", listing._id))
        .take(1);
      if (photos.length === 0) {
        throw new ConvexError(listingError(ListingErrorCode.InvalidState));
      }
      const [subscriptions, publishedListings] = await Promise.all([
        ctx.db
          .query("billingSubscriptions")
          .withIndex("by_clerk_user_id_and_updated_at", (q) =>
            q.eq("clerkUserId", profile.clerkUserId),
          )
          .order("desc")
          .take(10),
        ctx.db
          .query("listings")
          .withIndex("by_owner_profile_id_and_status", (q) =>
            q.eq("ownerProfileId", profile._id).eq("status", "published"),
          )
          .take(10),
      ]);
      const allowance = Math.max(
        ...subscriptions.map((subscription) => publicationAllowance(subscription, Date.now())),
        1,
      );
      if (publishedListings.length >= allowance) {
        throw new ConvexError(listingError(ListingErrorCode.InvalidState));
      }
    }

    const now = Date.now();
    const fields = {
      status: args.status,
      updatedAt: now,
      ...(args.status === "published" ? { publishedAt: now } : {}),
      ...(args.status === "published"
        ? { ...listingSearchFields(listing.publicLocation) }
        : {}),
      ...(args.status === "archived" ? { archivedAt: now } : {}),
      ...(args.status === "published" ? { bookingSuspended: false } : {}),
    };
    await ctx.db.patch(listing._id, fields);
    return { ...listing, ...fields };
  },
});

export const deleteDraft = mutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { listing } = await getOwnedListing(ctx, args.listingId);
    assertPolicy(() => assertListingCanBeDeleted(listing.status, Boolean(listing.publishedAt)));

    const [photos, uploads, blockedDates, overrides] = await Promise.all([
      ctx.db
        .query("listingPhotos")
        .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", listing._id))
        .take(MAX_LISTING_PHOTOS + 1),
      ctx.db
        .query("pendingListingPhotoUploads")
        .withIndex("by_listing_id", (q) => q.eq("listingId", listing._id))
        .take(MAX_LISTING_PHOTOS + 1),
      ctx.db
        .query("blockedDates")
        .withIndex("by_listing_id", (q) => q.eq("listingId", listing._id))
        .take(MAX_LISTING_CALENDAR_DAYS + 1),
      ctx.db
        .query("nightlyPriceOverrides")
        .withIndex("by_listing_id", (q) => q.eq("listingId", listing._id))
        .take(MAX_LISTING_CALENDAR_DAYS + 1),
    ]);
    if (
      photos.length > MAX_LISTING_PHOTOS ||
      uploads.length > MAX_LISTING_PHOTOS ||
      blockedDates.length > MAX_LISTING_CALENDAR_DAYS ||
      overrides.length > MAX_LISTING_CALENDAR_DAYS
    ) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidState));
    }
    await Promise.all([
      ...photos.map((photo) => ctx.db.delete(photo._id)),
      ...uploads.map(async (upload) => {
        await ctx.storage.delete(upload.storageId);
        await ctx.db.delete(upload._id);
      }),
      ...blockedDates.map((date) => ctx.db.delete(date._id)),
      ...overrides.map((override) => ctx.db.delete(override._id)),
    ]);
    await ctx.db.delete(listing._id);
    return null;
  },
});

export const generatePhotoUploadUrl = mutation({
  args: { listingId: v.id("listings") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await getOwnedListing(ctx, args.listingId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerUploadedPhoto = mutation({
  args: { listingId: v.id("listings"), storageId: v.id("_storage") },
  returns: v.id("pendingListingPhotoUploads"),
  handler: async (ctx, args) => {
    const { listing, profile } = await getOwnedListing(ctx, args.listingId);
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidPhoto));
    }
    return await ctx.db.insert("pendingListingPhotoUploads", {
      listingId: listing._id,
      ownerProfileId: profile._id,
      storageId: args.storageId,
      status: "pending",
      expiresAt: Date.now() + PHOTO_UPLOAD_TTL_MS,
      createdAt: Date.now(),
    });
  },
});

export const attachPhoto = mutation({
  args: {
    listingId: v.id("listings"),
    uploadId: v.id("pendingListingPhotoUploads"),
    altText: v.optional(v.string()),
  },
  returns: photoValidator,
  handler: async (ctx, args) => {
    const { listing, profile } = await getOwnedListing(ctx, args.listingId);
    const upload = await ctx.db.get(args.uploadId);
    if (
      !upload ||
      upload.listingId !== listing._id ||
      upload.ownerProfileId !== profile._id ||
      upload.expiresAt < Date.now()
    ) {
      throw new ConvexError(listingError(ListingErrorCode.UploadNotFound));
    }
    const photos = await ctx.db
      .query("listingPhotos")
      .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", listing._id))
      .take(MAX_LISTING_PHOTOS + 1);
    if (photos.length >= MAX_LISTING_PHOTOS) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidPhoto));
    }
    const createdAt = Date.now();
    const photoId = await ctx.db.insert("listingPhotos", {
      listingId: listing._id,
      storageId: upload.storageId,
      altText: args.altText,
      position: photos.length,
      createdAt,
    });
    await ctx.db.delete(upload._id);
    if (!listing.coverPhotoId) {
      await ctx.db.patch(listing._id, { coverPhotoId: photoId, updatedAt: createdAt });
    }
    const photo = await ctx.db.get(photoId);
    if (!photo) {
      throw new Error("Photo attachment failed unexpectedly.");
    }
    return photo;
  },
});

export const removePhoto = mutation({
  args: { listingId: v.id("listings"), photoId: v.id("listingPhotos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { listing } = await getOwnedListing(ctx, args.listingId);
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.listingId !== listing._id) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidPhoto));
    }
    await ctx.db.delete(photo._id);
    await ctx.storage.delete(photo.storageId);
    if (listing.coverPhotoId === photo._id) {
      const [nextPhoto] = await ctx.db
        .query("listingPhotos")
        .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", listing._id))
        .take(1);
      if (nextPhoto) {
        await ctx.db.patch(listing._id, {
          coverPhotoId: nextPhoto._id,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.patch(listing._id, {
          coverPhotoId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
    return null;
  },
});

export const setPhotoOrder = mutation({
  args: { listingId: v.id("listings"), photoIds: v.array(v.id("listingPhotos")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { listing } = await getOwnedListing(ctx, args.listingId);
    if (args.photoIds.length > MAX_LISTING_PHOTOS || new Set(args.photoIds).size !== args.photoIds.length) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidPhoto));
    }
    const existing = await ctx.db
      .query("listingPhotos")
      .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", listing._id))
      .take(MAX_LISTING_PHOTOS + 1);
    if (
      existing.length !== args.photoIds.length ||
      existing.some((photo) => !args.photoIds.includes(photo._id))
    ) {
      throw new ConvexError(listingError(ListingErrorCode.InvalidPhoto));
    }
    await Promise.all(args.photoIds.map((photoId, position) => ctx.db.patch(photoId, { position })));
    return null;
  },
});

export const setBlockedDate = mutation({
  args: { listingId: v.id("listings"), date: v.string(), blocked: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { listing } = await getOwnedListing(ctx, args.listingId);
    if (!isValidStayDate(args.date)) {
      throwInvalidInput();
    }
    const existing = await ctx.db
      .query("blockedDates")
      .withIndex("by_listing_id_and_date", (q) =>
        q.eq("listingId", listing._id).eq("date", args.date),
      )
      .unique();
    if (args.blocked && !existing) {
      const dates = await ctx.db
        .query("blockedDates")
        .withIndex("by_listing_id", (q) => q.eq("listingId", listing._id))
        .take(MAX_LISTING_CALENDAR_DAYS + 1);
      if (dates.length >= MAX_LISTING_CALENDAR_DAYS) {
        throwInvalidInput();
      }
      await ctx.db.insert("blockedDates", {
        listingId: listing._id,
        date: args.date,
        createdAt: Date.now(),
      });
    }
    if (!args.blocked && existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const setNightlyPriceOverride = mutation({
  args: {
    listingId: v.id("listings"),
    date: v.string(),
    nightlyPriceCents: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { listing } = await getOwnedListing(ctx, args.listingId);
    if (
      !isValidStayDate(args.date) ||
      (args.nightlyPriceCents !== null &&
        (!Number.isInteger(args.nightlyPriceCents) || args.nightlyPriceCents < 1))
    ) {
      throwInvalidInput();
    }
    const existing = await ctx.db
      .query("nightlyPriceOverrides")
      .withIndex("by_listing_id_and_date", (q) =>
        q.eq("listingId", listing._id).eq("date", args.date),
      )
      .unique();
    if (args.nightlyPriceCents === null) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { nightlyPriceCents: args.nightlyPriceCents, updatedAt: now });
      return null;
    }
    const overrides = await ctx.db
      .query("nightlyPriceOverrides")
      .withIndex("by_listing_id", (q) => q.eq("listingId", listing._id))
      .take(MAX_LISTING_CALENDAR_DAYS + 1);
    if (overrides.length >= MAX_LISTING_CALENDAR_DAYS) throwInvalidInput();
    await ctx.db.insert("nightlyPriceOverrides", {
      listingId: listing._id,
      date: args.date,
      nightlyPriceCents: args.nightlyPriceCents,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const myListings = query({
  args: {},
  returns: v.array(listingValidator),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    return await ctx.db
      .query("listings")
      .withIndex("by_owner_profile_id", (q) => q.eq("ownerProfileId", profile._id))
      .order("desc")
      .take(100);
  },
});

const publicListingValidator = v.object({
  _id: v.id("listings"),
  title: v.string(),
  description: v.string(),
  propertyType: propertyTypeValidator,
  category: v.string(),
  maxGuests: v.number(),
  bedrooms: v.number(),
  beds: v.number(),
  bathrooms: v.number(),
  amenities: v.array(v.string()),
  rules: v.array(v.string()),
  publicLocation: publicLocationValidator,
  timezone: v.string(),
  checkInTime: v.string(),
  checkOutTime: v.string(),
  nightlyPriceCents: v.number(),
  cleaningFeeCents: v.number(),
  currency: v.literal("USD"),
  bookingMode: bookingModeValidator,
  photos: v.array(v.object({
    _id: v.id("listingPhotos"),
    url: v.union(v.string(), v.null()),
    altText: v.optional(v.string()),
    position: v.number(),
  })),
});

export const getPublished = query({
  args: { listingId: v.id("listings") },
  returns: v.union(publicListingValidator, v.null()),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.status !== "published" || listing.bookingSuspended) return null;
    const photos = await ctx.db
      .query("listingPhotos")
      .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", listing._id))
      .take(MAX_LISTING_PHOTOS);
    return {
      _id: listing._id,
      title: listing.title,
      description: listing.description,
      propertyType: listing.propertyType,
      category: listing.category,
      maxGuests: listing.maxGuests,
      bedrooms: listing.bedrooms,
      beds: listing.beds,
      bathrooms: listing.bathrooms,
      amenities: listing.amenities,
      rules: listing.rules,
      publicLocation: listing.publicLocation,
      timezone: listing.timezone,
      checkInTime: listing.checkInTime,
      checkOutTime: listing.checkOutTime,
      nightlyPriceCents: listing.nightlyPriceCents,
      cleaningFeeCents: listing.cleaningFeeCents,
      currency: listing.currency,
      bookingMode: listing.bookingMode,
      photos: await Promise.all(
        photos.map(async (photo) => ({
          _id: photo._id,
          url: await ctx.storage.getUrl(photo.storageId),
          altText: photo.altText,
          position: photo.position,
        })),
      ),
    };
  },
});

export const cleanupExpiredPhotoUploads = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const uploads = await ctx.db
      .query("pendingListingPhotoUploads")
      .withIndex("by_status_and_expires_at", (q) =>
        q.eq("status", "pending").lt("expiresAt", Date.now()),
      )
      .take(limit);
    await Promise.all(
      uploads.map(async (upload) => {
        await ctx.storage.delete(upload.storageId);
        await ctx.db.delete(upload._id);
      }),
    );
    return { deleted: uploads.length };
  },
});
