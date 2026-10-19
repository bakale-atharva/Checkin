import { ConvexError, v } from "convex/values";

import {
  MAX_SEARCH_CANDIDATES,
  SEARCH_SNAPSHOT_TTL_MS,
  SearchValidationError,
  buildSearchSnapshot,
  normalizeSearchInput,
  pageSnapshotIds,
  type SearchInput,
} from "../lib/search/search-contract";
import { seededDestinations } from "../lib/search/seeded-destinations";
import type { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { listingPhotoUrl } from "./photoSources";

const propertyTypeValidator = v.union(
  v.literal("entire_home"),
  v.literal("private_room"),
  v.literal("shared_room"),
);
const bookingModeValidator = v.union(
  v.literal("instant"),
  v.literal("request"),
);
const sortValidator = v.union(
  v.literal("price"),
  v.literal("rating"),
  v.literal("distance"),
);
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
  coverPhotoUrl: v.union(v.string(), v.null()),
  coverPhotoAlt: v.optional(v.string()),
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
      const [blocked, reserved] = await Promise.all([
        ctx.db
          .query("blockedDates")
          .withIndex("by_listing_id_and_date", (q) =>
            q
              .eq("listingId", listing._id)
              .gte("date", checkIn)
              .lt("date", checkOut),
          )
          .take(1),
        ctx.db
          .query("reservationNights")
          .withIndex("by_listing_id_and_date", (q) =>
            q
              .eq("listingId", listing._id)
              .gte("date", checkIn)
              .lt("date", checkOut),
          )
          .take(1),
      ]);
      return blocked.length > 0 || reserved.length > 0
        ? String(listing._id)
        : null;
    }),
  );
  return new Set(
    blocked.filter((listingId): listingId is string => listingId !== null),
  );
}

async function deleteSnapshot(
  ctx: MutationCtx,
  snapshotId: Id<"searchSnapshots">,
) {
  const results = await ctx.db
    .query("searchSnapshotResults")
    .withIndex("by_snapshot_id_and_position", (q) =>
      q.eq("snapshotId", snapshotId),
    )
    .take(MAX_SEARCH_CANDIDATES + 1);
  await Promise.all(results.map((result) => ctx.db.delete(result._id)));
  await ctx.db.delete(snapshotId);
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
    const [expiredSnapshot] = await ctx.db
      .query("searchSnapshots")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .take(1);
    if (expiredSnapshot) await deleteSnapshot(ctx, expiredSnapshot._id);

    const rawCandidates = await candidatesFor(ctx, input.destination);
    if (rawCandidates.length > MAX_SEARCH_CANDIDATES) {
      throw searchError(
        "SEARCH_TOO_BROAD",
        "Search is too broad. Choose a narrower destination or filters.",
      );
    }
    const candidates = rawCandidates.filter(
      (listing) => !listing.bookingSuspended,
    );
    const unavailable = await unavailableListingIds(
      ctx,
      candidates,
      input.checkIn,
      input.checkOut,
    );
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
    const byId = new Map(
      candidates.map((listing) => [String(listing._id), listing]),
    );
    const expiresAt = now + SEARCH_SNAPSHOT_TTL_MS;
    const snapshotId = await ctx.db.insert("searchSnapshots", {
      total: snapshot.listingIds.length,
      expiresAt,
      createdAt: now,
    });
    await Promise.all(
      snapshot.listingIds.map(async (listingId, position) => {
        const listing = byId.get(listingId);
        if (!listing)
          throw new Error("Search snapshot contained an unknown listing.");
        await ctx.db.insert("searchSnapshotResults", {
          snapshotId,
          position,
          ...searchResult(listing),
        });
      }),
    );
    await ctx.scheduler.runAfter(
      SEARCH_SNAPSHOT_TTL_MS,
      internal.search.expireSnapshot,
      {
        snapshotId,
      },
    );
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
      throw searchError(
        "SEARCH_SNAPSHOT_EXPIRED",
        "This search has expired. Run it again.",
      );
    }
    try {
      pageSnapshotIds([], args.offset);
    } catch (error) {
      if (error instanceof SearchValidationError) {
        throw searchError("INVALID_SEARCH_PAGE", error.message);
      }
      throw error;
    }
    const resultRows = await ctx.db
      .query("searchSnapshotResults")
      .withIndex("by_snapshot_id_and_position", (q) =>
        q.eq("snapshotId", snapshot._id).gte("position", args.offset),
      )
      .take(24);
    const listings = await Promise.all(
      resultRows.map((result) => ctx.db.get(result.listingId)),
    );
    const covers = await Promise.all(
      resultRows.map(async (result) => {
        const photo = result.coverPhotoId
          ? await ctx.db.get(result.coverPhotoId)
          : null;
        return photo
          ? {
              url: await listingPhotoUrl(ctx, photo),
              altText: photo.altText,
            }
          : { url: null, altText: undefined };
      }),
    );
    const nextOffset = args.offset + resultRows.length;
    return {
      page: resultRows
        .map((result, index) => ({ result, index }))
        .filter(({ index }) => {
          const listing = listings[index];
          return listing?.status === "published" && !listing.bookingSuspended;
        })
        .map(({ result, index }) => ({
          listingId: result.listingId,
          title: result.title,
          city: result.city,
          region: result.region,
          countryCode: result.countryCode,
          latitude: result.latitude,
          longitude: result.longitude,
          nightlyPriceCents: result.nightlyPriceCents,
          publishedRating: result.publishedRating,
          maxGuests: result.maxGuests,
          category: result.category,
          propertyType: result.propertyType,
          amenities: result.amenities,
          bookingMode: result.bookingMode,
          coverPhotoId: result.coverPhotoId,
          coverPhotoUrl: covers[index].url,
          coverPhotoAlt: covers[index].altText,
        })),
      nextOffset,
      isDone: nextOffset >= snapshot.total,
      expiresAt: snapshot.expiresAt,
    };
  },
});

export const expireSnapshot = internalMutation({
  args: { snapshotId: v.id("searchSnapshots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (snapshot && snapshot.expiresAt <= Date.now())
      await deleteSnapshot(ctx, snapshot._id);
    return null;
  },
});

export const backfillSearchFields = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("listings")
      .withIndex("by_status_and_created_at", (q) => q.eq("status", "published"))
      .paginate(args.paginationOpts);
    let updated = 0;
    await Promise.all(
      page.page.map(async (listing) => {
        const fields = {
          searchCity: listing.publicLocation.city
            .trim()
            .toLocaleLowerCase("en-US"),
          searchCountryCode: listing.publicLocation.countryCode
            .trim()
            .toUpperCase(),
        };
        if (
          listing.searchCity !== fields.searchCity ||
          listing.searchCountryCode !== fields.searchCountryCode
        ) {
          await ctx.db.patch(listing._id, fields);
          updated += 1;
        }
      }),
    );
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      updated,
    };
  },
});

export const destinationFallbacks = query({
  args: {},
  returns: v.array(
    v.object({
      city: v.string(),
      countryCode: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
  ),
  handler: () => seededDestinations.map((destination) => ({ ...destination })),
});
