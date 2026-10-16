import { ConvexError, v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { listingSearchFields } from "../lib/search/listing-search-fields";

const SEED_LISTING_COUNT = 60;

const cities = [
  { city: "Lisbon", countryCode: "PT", timezone: "Europe/Lisbon", latitude: 38.7223, longitude: -9.1393 },
  { city: "Kyoto", countryCode: "JP", timezone: "Asia/Tokyo", latitude: 35.0116, longitude: 135.7681 },
  { city: "Austin", countryCode: "US", timezone: "America/Chicago", latitude: 30.2672, longitude: -97.7431 },
  { city: "Reykjavik", countryCode: "IS", timezone: "Atlantic/Reykjavik", latitude: 64.1466, longitude: -21.9426 },
  { city: "Melbourne", countryCode: "AU", timezone: "Australia/Melbourne", latitude: -37.8136, longitude: 144.9631 },
] as const;

const homeNames = ["Sunlit", "Quiet", "Garden", "Harbor", "Cedar", "Terrace"] as const;
const homeTypes = ["entire_home", "private_room", "shared_room"] as const;

/**
 * Seeds only an explicitly supplied non-production fixture set. Callers must
 * upload sixty licensed demo images first and pass their storage IDs; this
 * avoids embedding unlicensed remote image URLs in application data.
 */
export const seedListings = internalMutation({
  args: {
    seedKey: v.string(),
    hostProfileIds: v.array(v.id("users")),
    photoStorageIds: v.array(v.id("_storage")),
  },
  returns: v.object({ created: v.number(), skipped: v.boolean() }),
  handler: async (ctx, args) => {
    if (args.hostProfileIds.length < 3 || args.photoStorageIds.length < SEED_LISTING_COUNT) {
      throw new ConvexError({
        code: "INVALID_SEED_INPUT",
        message: "Provide at least three host profiles and sixty licensed photo storage IDs.",
      });
    }
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_seed_key", (q) => q.eq("seedKey", args.seedKey))
      .take(1);
    if (existing.length > 0) return { created: 0, skipped: true };

    const hosts = await Promise.all(args.hostProfileIds.map((profileId) => ctx.db.get(profileId)));
    if (hosts.some((host) => host === null)) {
      throw new ConvexError({
        code: "INVALID_SEED_INPUT",
        message: "Every supplied host profile must exist.",
      });
    }

    const now = Date.now();
    for (let index = 0; index < SEED_LISTING_COUNT; index += 1) {
      const city = cities[index % cities.length];
      const status = index < 48 ? "published" : index < 58 ? "draft" : "archived";
      const propertyType = homeTypes[index % homeTypes.length];
      const listingId = await ctx.db.insert("listings", {
        ownerProfileId: args.hostProfileIds[index % args.hostProfileIds.length],
        status,
        title: `${homeNames[index % homeNames.length]} ${propertyType.replace("_", " ")} in ${city.city}`,
        description: `A fictional Checkin seed stay in ${city.city}.`,
        propertyType,
        category: index % 2 === 0 ? "Design stays" : "Countryside",
        maxGuests: (index % 6) + 1,
        bedrooms: (index % 3) + 1,
        beds: (index % 4) + 1,
        bathrooms: 1,
        amenities: ["Wifi", "Kitchen", "Workspace"],
        rules: ["No smoking", "No parties"],
        privateAddress: {
          line1: `${index + 1} Fictional Lane`,
          city: city.city,
          postalCode: "00000",
          countryCode: city.countryCode,
        },
        publicLocation: {
          city: city.city,
          countryCode: city.countryCode,
          latitude: city.latitude + index * 0.001,
          longitude: city.longitude + index * 0.001,
        },
        timezone: city.timezone,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        nightlyPriceCents: 8500 + index * 275,
        cleaningFeeCents: 2500,
        currency: "USD",
        bookingMode: index % 2 === 0 ? "instant" : "request",
        ...listingSearchFields(city),
        ...(status === "published" ? { publishedAt: now } : {}),
        ...(status === "archived" ? { archivedAt: now } : {}),
        seedKey: args.seedKey,
        createdAt: now,
        updatedAt: now,
      });
      const photoId = await ctx.db.insert("listingPhotos", {
        listingId,
        storageId: args.photoStorageIds[index],
        position: 0,
        altText: `Fictional seed stay in ${city.city}`,
        createdAt: now,
      });
      await ctx.db.patch(listingId, { coverPhotoId: photoId });

      if (index % 3 === 0) {
        await ctx.db.insert("blockedDates", {
          listingId,
          date: "2027-01-15",
          createdAt: now,
        });
      }
      if (index % 4 === 0) {
        await ctx.db.insert("nightlyPriceOverrides", {
          listingId,
          date: "2027-01-20",
          nightlyPriceCents: 17500,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return { created: SEED_LISTING_COUNT, skipped: false };
  },
});
