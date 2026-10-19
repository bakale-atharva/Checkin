import { ConvexError, v } from "convex/values";

import {
  allowsSimulatorControls,
  parseDeploymentRole,
} from "../lib/operations/deployment-role";
import {
  buildSeedListings,
  buildSeedStays,
  isAllowedExternalPhotoUrl,
  seedBlockedDayOffsets,
  seedCities,
  seedGuests,
  seedHosts,
  seedPriceOverrideDayOffsets,
} from "../lib/listings/seed-catalog";
import {
  createReservationQuote,
  stayDates,
} from "../lib/reservations/reservation-policy";
import { listingSearchFields } from "../lib/search/listing-search-fields";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const DEFAULT_SEED_KEY = "demo";
const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_LIMIT = 1_000;
const SEED_DAYS_OF_HISTORY = 400;

function assertSeedingAllowed() {
  if (
    !allowsSimulatorControls(
      parseDeploymentRole(process.env.CHECKIN_DEPLOYMENT_ROLE),
    )
  ) {
    throw new ConvexError({
      code: "SEEDING_DISABLED",
      message:
        "Seed data is limited to deployments with CHECKIN_DEPLOYMENT_ROLE set to test or demo.",
    });
  }
}

function normalizeSeedKey(seedKey: string | undefined) {
  const key = seedKey ?? DEFAULT_SEED_KEY;
  if (!/^[a-z0-9_-]{1,40}$/.test(key)) {
    throw new ConvexError({
      code: "INVALID_SEED_INPUT",
      message: "Seed keys use 1–40 lowercase letters, digits, - or _.",
    });
  }
  return key;
}

/** Seed identities can never sign in: no Clerk session carries this issuer. */
function seedTokenIdentifier(
  seedKey: string,
  role: "host" | "guest",
  n: number,
) {
  return `seed.checkin.invalid|${seedKey}-${role}-${n}`;
}

function dayOffset(today: string, offset: number) {
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

async function insertPeople(ctx: MutationCtx, seedKey: string, now: number) {
  const insert = (role: "host" | "guest", name: string, n: number) =>
    ctx.db.insert("users", {
      tokenIdentifier: seedTokenIdentifier(seedKey, role, n),
      clerkUserId: `seed_${seedKey}_${role}_${n}`,
      name,
      createdAt: now,
      updatedAt: now,
    });
  const hosts: Id<"users">[] = [];
  for (const [n, name] of seedHosts.entries())
    hosts.push(await insert("host", name, n));
  const guests: Id<"users">[] = [];
  for (const [n, name] of seedGuests.entries())
    guests.push(await insert("guest", name, n));
  return { hosts, guests };
}

/**
 * Seeds fictional, browsable demo inventory: hosts and guests, sixty listings
 * with Unsplash photos, availability, completed stays with revealed two-way
 * reviews, and a few upcoming confirmed stays. Idempotent per seed key.
 * Run with `pnpm seed`; only test and demo deployments accept it.
 */
export const seedDemo = internalMutation({
  args: { seedKey: v.optional(v.string()) },
  returns: v.object({
    seedKey: v.string(),
    skipped: v.boolean(),
    listings: v.number(),
    stays: v.number(),
    reviews: v.number(),
  }),
  handler: async (ctx, args) => {
    assertSeedingAllowed();
    const seedKey = normalizeSeedKey(args.seedKey);
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_seed_key", (q) => q.eq("seedKey", seedKey))
      .take(1);
    if (existing.length > 0)
      return { seedKey, skipped: true, listings: 0, stays: 0, reviews: 0 };

    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const people = await insertPeople(ctx, seedKey, now);
    const specs = buildSeedListings();
    const listings: Doc<"listings">[] = [];

    for (const spec of specs) {
      const city = seedCities[spec.cityIndex];
      const createdAt = now - (SEED_DAYS_OF_HISTORY - spec.index) * DAY_MS;
      const listingId = await ctx.db.insert("listings", {
        ownerProfileId: people.hosts[spec.hostIndex],
        status: spec.status,
        title: spec.title,
        description: spec.description,
        propertyType: spec.propertyType,
        category: spec.category,
        maxGuests: spec.maxGuests,
        bedrooms: spec.bedrooms,
        beds: spec.beds,
        bathrooms: spec.bathrooms,
        amenities: spec.amenities,
        rules: spec.rules,
        privateAddress: {
          line1: `${spec.index + 1} Fictional Lane`,
          city: city.city,
          region: city.region,
          postalCode: "00000",
          countryCode: city.countryCode,
        },
        publicLocation: {
          city: city.city,
          region: city.region,
          countryCode: city.countryCode,
          latitude: spec.latitude,
          longitude: spec.longitude,
        },
        timezone: city.timezone,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        nightlyPriceCents: spec.nightlyPriceCents,
        cleaningFeeCents: spec.cleaningFeeCents,
        currency: "USD",
        bookingMode: spec.bookingMode,
        ...listingSearchFields(city),
        ...(spec.status === "published" ? { publishedAt: createdAt } : {}),
        ...(spec.status === "archived" ? { archivedAt: now } : {}),
        seedKey,
        createdAt,
        updatedAt: now,
      });

      let coverPhotoId: Id<"listingPhotos"> | undefined;
      for (const [position, photo] of spec.photos.entries()) {
        if (!isAllowedExternalPhotoUrl(photo.url))
          throw new Error(`Seed photo is not an allowed link: ${photo.url}`);
        const photoId = await ctx.db.insert("listingPhotos", {
          listingId,
          externalUrl: photo.url,
          altText: photo.alt,
          position,
          createdAt,
        });
        coverPhotoId ??= photoId;
      }
      await ctx.db.patch(listingId, { coverPhotoId });

      if (spec.index % 3 === 0) {
        for (const offset of seedBlockedDayOffsets)
          await ctx.db.insert("blockedDates", {
            listingId,
            date: dayOffset(today, offset),
            createdAt: now,
          });
      }
      if (spec.index % 4 === 0) {
        for (const offset of seedPriceOverrideDayOffsets)
          await ctx.db.insert("nightlyPriceOverrides", {
            listingId,
            date: dayOffset(today, offset),
            nightlyPriceCents:
              Math.round((spec.nightlyPriceCents * 1.25) / 100) * 100,
            createdAt: now,
            updatedAt: now,
          });
      }
      const listing = await ctx.db.get(listingId);
      if (!listing) throw new Error("Seeded listing disappeared.");
      listings.push(listing);
    }

    const ratings = new Map<Id<"listings">, Doc<"reviews">["guestRatings"][]>();
    let reviewCount = 0;
    const stays = buildSeedStays(specs);
    for (const [n, stay] of stays.entries()) {
      const listing = listings[stay.listingIndex];
      const guestProfileId = people.guests[stay.guestIndex];
      const checkIn = dayOffset(today, stay.checkInOffset);
      const checkOut = dayOffset(today, stay.checkInOffset + stay.nights);
      const overrides: Record<string, number> = {};
      for (const override of await ctx.db
        .query("nightlyPriceOverrides")
        .withIndex("by_listing_id", (q) => q.eq("listingId", listing._id))
        .take(10))
        overrides[override.date] = override.nightlyPriceCents;
      const quote = createReservationQuote({
        checkIn,
        checkOut,
        timezone: listing.timezone,
        checkInTime: listing.checkInTime,
        checkOutTime: listing.checkOutTime,
        nightlyPriceCents: listing.nightlyPriceCents,
        cleaningFeeCents: listing.cleaningFeeCents,
        nightlyPriceOverrides: overrides,
      });
      const bookedAt = Math.min(now, Date.parse(quote.checkInAt) - 21 * DAY_MS);
      const quoteId = await ctx.db.insert("reservationQuotes", {
        listingId: listing._id,
        guestProfileId,
        checkIn,
        checkOut,
        guests: stay.guests,
        expiresAt: bookedAt,
        quote,
        createdAt: bookedAt,
      });
      const { checkInAt, checkOutAt, cancellationDeadline, ...amounts } = quote;
      const reservationId = await ctx.db.insert("reservations", {
        listingId: listing._id,
        guestProfileId,
        hostProfileId: listing.ownerProfileId,
        quoteId,
        idempotencyKey: `seed:${seedKey}:${n}`,
        checkIn,
        checkOut,
        guests: stay.guests,
        bookingMode: listing.bookingMode,
        status: stay.kind === "completed" ? "completed" : "confirmed",
        paymentStatus: "paid",
        checkInAt,
        checkOutAt,
        cancellationDeadline,
        quote: amounts,
        createdAt: bookedAt,
        updatedAt:
          stay.kind === "completed" ? Date.parse(checkOutAt) : bookedAt,
      });
      for (const date of stayDates(checkIn, checkOut))
        await ctx.db.insert("reservationNights", {
          reservationId,
          listingId: listing._id,
          date,
          createdAt: bookedAt,
        });
      await ctx.db.insert("paymentOperations", {
        reservationId,
        kind: "charge",
        idempotencyKey: `charge:seed:${seedKey}:${n}`,
        amountCents: quote.totalCents,
        status: "succeeded",
        attempts: 1,
        createdAt: bookedAt,
        updatedAt: bookedAt,
      });

      if (stay.kind !== "completed" || !stay.review) continue;
      const checkedOutAt = Date.parse(checkOutAt);
      await ctx.db.insert("simulatedPayouts", {
        reservationId,
        hostProfileId: listing.ownerProfileId,
        amountCents: quote.hostProceedsCents,
        status: "paid",
        paidAt: checkedOutAt + DAY_MS,
        createdAt: checkedOutAt + DAY_MS,
      });
      const guestSubmittedAt = checkedOutAt + DAY_MS;
      const hostSubmittedAt = checkedOutAt + 2 * DAY_MS;
      await ctx.db.insert("reviews", {
        reservationId,
        listingId: listing._id,
        reviewerProfileId: guestProfileId,
        recipientProfileId: listing.ownerProfileId,
        kind: "guest_to_host",
        guestRatings: stay.review.guestRatings,
        comment: stay.review.guestComment,
        submittedAt: guestSubmittedAt,
        revealedAt: hostSubmittedAt,
      });
      await ctx.db.insert("reviews", {
        reservationId,
        listingId: listing._id,
        reviewerProfileId: listing.ownerProfileId,
        recipientProfileId: guestProfileId,
        kind: "host_to_guest",
        hostRatings: stay.review.hostRatings,
        comment: stay.review.hostComment,
        submittedAt: hostSubmittedAt,
        revealedAt: hostSubmittedAt,
      });
      reviewCount += 2;
      ratings.set(listing._id, [
        ...(ratings.get(listing._id) ?? []),
        stay.review.guestRatings,
      ]);
    }

    for (const [listingId, listingRatings] of ratings) {
      const total = (key: keyof NonNullable<(typeof listingRatings)[number]>) =>
        listingRatings.reduce((sum, rating) => sum + (rating?.[key] ?? 0), 0);
      const overallTotal = total("overall");
      await ctx.db.insert("reviewAggregates", {
        listingId,
        count: listingRatings.length,
        overallTotal,
        cleanlinessTotal: total("cleanliness"),
        accuracyTotal: total("accuracy"),
        checkInTotal: total("checkIn"),
        communicationTotal: total("communication"),
        locationTotal: total("location"),
        valueTotal: total("value"),
        updatedAt: now,
      });
      await ctx.db.patch(listingId, {
        publishedRating: overallTotal / listingRatings.length,
      });
    }

    return {
      seedKey,
      skipped: false,
      listings: listings.length,
      stays: stays.length,
      reviews: reviewCount,
    };
  },
});

async function deleteRows<T extends { _id: Id<TableNames> }>(
  ctx: MutationCtx,
  rows: T[],
) {
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length;
}

/**
 * Removes everything a seed key created (and nothing else). Wishlist entries
 * real users made for seeded stays are left; wishlist queries skip missing
 * listings. Run with `pnpm seed:reset`.
 */
export const resetDemo = internalMutation({
  args: { seedKey: v.optional(v.string()) },
  returns: v.object({ seedKey: v.string(), deleted: v.number() }),
  handler: async (ctx, args) => {
    assertSeedingAllowed();
    const seedKey = normalizeSeedKey(args.seedKey);
    let deleted = 0;

    const profiles: Doc<"users">[] = [];
    for (const [role, names] of [
      ["host", seedHosts],
      ["guest", seedGuests],
    ] as const) {
      for (const n of names.keys()) {
        const profile = await ctx.db
          .query("users")
          .withIndex("by_token_identifier", (q) =>
            q.eq("tokenIdentifier", seedTokenIdentifier(seedKey, role, n)),
          )
          .unique();
        if (profile) profiles.push(profile);
      }
    }

    for (const profile of profiles) {
      const reservations = await ctx.db
        .query("reservations")
        .withIndex("by_host_profile_id_and_created_at", (q) =>
          q.eq("hostProfileId", profile._id),
        )
        .take(RESET_LIMIT);
      for (const reservation of reservations) {
        const id = reservation._id;
        deleted += await deleteRows(
          ctx,
          await ctx.db
            .query("reservationNights")
            .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
            .take(RESET_LIMIT),
        );
        deleted += await deleteRows(
          ctx,
          await ctx.db
            .query("reviews")
            .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
            .take(10),
        );
        deleted += await deleteRows(
          ctx,
          await ctx.db
            .query("paymentOperations")
            .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
            .take(10),
        );
        deleted += await deleteRows(
          ctx,
          await ctx.db
            .query("simulatedPayouts")
            .withIndex("by_reservation_id", (q) => q.eq("reservationId", id))
            .take(10),
        );
        if (await ctx.db.get(reservation.quoteId)) {
          await ctx.db.delete(reservation.quoteId);
          deleted += 1;
        }
        await ctx.db.delete(id);
        deleted += 1;
      }
    }

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_seed_key", (q) => q.eq("seedKey", seedKey))
      .take(RESET_LIMIT);
    for (const listing of listings) {
      const id = listing._id;
      deleted += await deleteRows(
        ctx,
        await ctx.db
          .query("listingPhotos")
          .withIndex("by_listing_id_and_position", (q) => q.eq("listingId", id))
          .take(RESET_LIMIT),
      );
      deleted += await deleteRows(
        ctx,
        await ctx.db
          .query("blockedDates")
          .withIndex("by_listing_id", (q) => q.eq("listingId", id))
          .take(RESET_LIMIT),
      );
      deleted += await deleteRows(
        ctx,
        await ctx.db
          .query("nightlyPriceOverrides")
          .withIndex("by_listing_id", (q) => q.eq("listingId", id))
          .take(RESET_LIMIT),
      );
      deleted += await deleteRows(
        ctx,
        await ctx.db
          .query("reviewAggregates")
          .withIndex("by_listing_id", (q) => q.eq("listingId", id))
          .take(1),
      );
      await ctx.db.delete(id);
      deleted += 1;
    }

    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
      deleted += 1;
    }
    return { seedKey, deleted };
  },
});
