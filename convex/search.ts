import { ConvexError, v } from "convex/values";

import {
  SEARCH_SNAPSHOT_TTL_MS,
  SearchValidationError,
  buildSearchSnapshot,
  normalizeSearchInput,
  pageSnapshotIds,
  type SearchInput,
} from "../lib/search/search-contract";
import { seededDestinations } from "../lib/search/seeded-destinations";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const propertyTypeValidator = v.union(
  v.literal("entire_home"),
  v.literal("private_room"),
  v.literal("shared_room"),
);
const bookingModeValidator = v.union(v.literal("instant"), v.literal("request"));
const sortValidator = v.union(v.literal("price"), v.literal("rating"), v.literal("distance"));
const searchInputValidator = {
  destination: v.optional(v.string()),
  checkIn: v.optional(v.string()),
  checkOut: v.optional(v.string()),
  guests: v.optional(v.number()),
  category: v.optional(v.string()),
  propertyType: v.optional(propertyTypeValidator),
  minNightlyPriceCents: v.optional(v.number()),
  maxNightlyPriceCents: v.optional(v.number()),
  amenities: v.optional(v.array(v.string())),
  bookingMode: v.optional(bookingModeValidator),
  sort: v.optional(sortValidator),
  origin: v.optional(v.object({ latitude: v.number(), longitude: v.number() })),
};

const searchResultValidator = v.object({
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
  propertyType: propertyTypeValidator,
  amenities: v.array(v.string()),
  bookingMode: bookingModeValidator,
  coverPhotoId: v.optional(v.id("listingPhotos")),
});

function searchError(code: string, message: string) {
  return new ConvexError({ code, message });
}

function normalizeOrThrow(input: SearchInput) {
  try {
    return normalizeSearchInput(input);
  } catch (error) {
    if (error instanceof SearchValidationError) {
      throw searchError("INVALID_SEARCH", error.message);
    }
    throw error;
  }
}

async function candidatesFor(
  ctx: MutationCtx,
  destination: string | undefined,
) {
  if (destination) {
    return await ctx.db
      .query("listings")
      .withIndex("by_status_and_search_city", (q) =>
        q.eq("status", "published").eq("searchCity", destination),
      )
      .take(501);
  }
  return await ctx.db
    .query("listings")
    .withIndex("by_status", (q) => q.eq("status", "published"))
    .take(501);
}

async function unavailableListingIds(
  ctx: MutationCtx,
  listings: Doc<"listings">[],
  checkIn: string | undefined,
  checkOut: string | undefined,
) {
  if (!checkIn || !checkOut) return new Set<string>();
  const blocked = await Promise.all(
    listings.map(async (listing) => {
      const matches = await ctx.db
        .query("blockedDates")
        .withIndex("by_listing_id_and_date", (q) =>
          q.eq("listingId", listing._id).gte("date", checkIn).lt("date", checkOut),
        )
        .take(1);
      return matches.length > 0 ? String(listing._id) : null;
    }),
  );
  return new Set(blocked.filter((listingId): listingId is string => listingId !== null));
}

function searchResult(listing: Doc<"listings">) {
  return {
    listingId: listing._id,
    title: listing.title,
    city: listing.publicLocation.city,
    region: listing.publicLocation.region,
    countryCode: listing.publicLocation.countryCode,
    latitude: listing.publicLocation.latitude,
    longitude: listing.publicLocation.longitude,
    nightlyPriceCents: listing.nightlyPriceCents,
    publishedRating: listing.publishedRating ?? 0,
    maxGuests: listing.maxGuests,
    category: listing.category,
    propertyType: listing.propertyType,
    amenities: listing.amenities,
    bookingMode: listing.bookingMode,
    coverPhotoId: listing.coverPhotoId,
  };
}

export const createSnapshot = mutation({
  args: searchInputValidator,
  returns: v.object({
    snapshotId: v.id("searchSnapshots"),
    expiresAt: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const input = normalizeOrThrow(args);
    const now = Date.now();
    const expiredSnapshots = await ctx.db
      .query("searchSnapshots")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .take(100);
    await Promise.all(expiredSnapshots.map((snapshot) => ctx.db.delete(snapshot._id)));

    const candidates = (await candidatesFor(ctx, input.destination)).filter(
      (listing) => !listing.bookingSuspended,
    );
    const unavailable = await unavailableListingIds(ctx, candidates, input.checkIn, input.checkOut);
    let snapshot;
    try {
      snapshot = buildSearchSnapshot(
        candidates.map((listing) => ({
          _id: String(listing._id),
          title: listing.title,
          city: listing.publicLocation.city,
          countryCode: listing.publicLocation.countryCode,
          latitude: listing.publicLocation.latitude,
          longitude: listing.publicLocation.longitude,
          nightlyPriceCents: listing.nightlyPriceCents,
          publishedRating: listing.publishedRating ?? 0,
          maxGuests: listing.maxGuests,
          category: listing.category,
          propertyType: listing.propertyType,
          amenities: listing.amenities,
          bookingMode: listing.bookingMode,
        })),
        input,
        unavailable,
      );
    } catch (error) {
      if (error instanceof SearchValidationError) {
        throw searchError("SEARCH_TOO_BROAD", error.message);
      }
      throw error;
    }
    const byId = new Map(candidates.map((listing) => [String(listing._id), listing._id]));
    const expiresAt = now + SEARCH_SNAPSHOT_TTL_MS;
    const snapshotId = await ctx.db.insert("searchSnapshots", {
      listingIds: snapshot.listingIds.map((listingId) => {
        const id = byId.get(listingId);
        if (!id) throw new Error("Search snapshot contained an unknown listing.");
        return id;
      }),
      expiresAt,
      createdAt: now,
    });
    return { snapshotId, expiresAt, total: snapshot.listingIds.length };
  },
});

export const page = query({
  args: { snapshotId: v.id("searchSnapshots"), offset: v.number() },
  returns: v.object({
    page: v.array(searchResultValidator),
    nextOffset: v.number(),
    isDone: v.boolean(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.expiresAt <= Date.now()) {
      throw searchError("SEARCH_SNAPSHOT_EXPIRED", "This search has expired. Run it again.");
    }
    let page;
    try {
      page = pageSnapshotIds(snapshot.listingIds.map(String), args.offset);
    } catch (error) {
      if (error instanceof SearchValidationError) {
        throw searchError("INVALID_SEARCH_PAGE", error.message);
      }
      throw error;
    }
    const listings = await Promise.all(
      page.listingIds.map((listingId) => ctx.db.get(listingId as Id<"listings">)),
    );
    return {
      page: listings
        .filter(
          (listing): listing is Doc<"listings"> =>
            listing !== null && listing.status === "published" && !listing.bookingSuspended,
        )
        .map(searchResult),
      nextOffset: page.nextOffset,
      isDone: page.isDone,
      expiresAt: snapshot.expiresAt,
    };
  },
});

export const destinationFallbacks = query({
  args: {},
  returns: v.array(
    v.object({ city: v.string(), countryCode: v.string(), latitude: v.number(), longitude: v.number() }),
  ),
  handler: () => seededDestinations.map((destination) => ({ ...destination })),
});
