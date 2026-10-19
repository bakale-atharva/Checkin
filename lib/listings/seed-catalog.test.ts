import assert from "node:assert/strict";
import test from "node:test";

import { discoveryAmenities, discoveryCategories } from "../discovery/catalog";
import { seededDestinations } from "../search/seeded-destinations";
import { stayDates } from "../reservations/reservation-policy";
import {
  SEED_DRAFT_COUNT,
  SEED_LISTING_COUNT,
  SEED_PUBLISHED_COUNT,
  buildSeedListings,
  buildSeedStays,
  isAllowedExternalPhotoUrl,
  seedBlockedDayOffsets,
  seedCities,
  seedPhotoLibrary,
  seedPriceOverrideDayOffsets,
} from "./seed-catalog";

const listings = buildSeedListings();
const stays = buildSeedStays(listings);

test("builds the same sixty listings on every run", () => {
  assert.equal(listings.length, SEED_LISTING_COUNT);
  assert.deepEqual(buildSeedListings(), listings);
  assert.deepEqual(buildSeedStays(buildSeedListings()), stays);
});

test("mixes published, draft, and archived listings", () => {
  const count = (status: string) =>
    listings.filter((listing) => listing.status === status).length;
  assert.equal(count("published"), SEED_PUBLISHED_COUNT);
  assert.equal(count("draft"), SEED_DRAFT_COUNT);
  assert.equal(
    count("archived"),
    SEED_LISTING_COUNT - SEED_PUBLISHED_COUNT - SEED_DRAFT_COUNT,
  );
});

test("covers every discovery category, property type, and booking mode", () => {
  const published = listings.filter(
    (listing) => listing.status === "published",
  );
  for (const category of discoveryCategories) {
    assert.ok(
      published.some((listing) => listing.category === category.value),
      `no published ${category.value} listing`,
    );
  }
  for (const type of ["entire_home", "private_room", "shared_room"]) {
    assert.ok(
      published.some((listing) => listing.propertyType === type),
      type,
    );
  }
  assert.ok(published.some((listing) => listing.bookingMode === "instant"));
  assert.ok(published.some((listing) => listing.bookingMode === "request"));
  assert.ok(
    new Set(published.map((listing) => listing.nightlyPriceCents)).size > 20,
    "prices should vary",
  );
});

test("only uses amenities the filters offer", () => {
  const offered = new Set<string>(discoveryAmenities);
  for (const listing of listings) {
    for (const amenity of listing.amenities)
      assert.ok(offered.has(amenity), amenity);
    assert.ok(listing.amenities.includes("Wifi"));
  }
});

test("keeps listings valid for the listing and reservation policies", () => {
  for (const listing of listings) {
    assert.ok(listing.maxGuests >= 1 && listing.maxGuests <= 16);
    assert.ok(
      Number.isInteger(listing.nightlyPriceCents) &&
        listing.nightlyPriceCents > 0,
    );
    assert.ok(listing.photos.length >= 2);
    assert.equal(
      new Set(listing.photos.map((photo) => photo.url)).size,
      listing.photos.length,
    );
    for (const photo of listing.photos)
      assert.ok(isAllowedExternalPhotoUrl(photo.url));
  }
});

test("matches the destinations the search fallbacks offer", () => {
  assert.deepEqual(
    seedCities.map((city) => city.city),
    seededDestinations.map((destination) => destination.city),
  );
});

test("uses each library photo ID once", () => {
  const ids = Object.values(seedPhotoLibrary)
    .flat()
    .map((photo) => photo.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("allows only Unsplash photo links", () => {
  assert.ok(
    isAllowedExternalPhotoUrl("https://images.unsplash.com/photo-123-abc?w=10"),
  );
  assert.ok(!isAllowedExternalPhotoUrl("https://evil.example/photo-123"));
  assert.ok(!isAllowedExternalPhotoUrl("http://images.unsplash.com/photo-123"));
  assert.ok(
    !isAllowedExternalPhotoUrl("https://images.unsplash.com/profile-123"),
  );
});

test("schedules non-overlapping stays clear of blocked and repriced days", () => {
  const byListing = new Map<number, Set<number>>();
  for (const stay of stays) {
    const listing = listings[stay.listingIndex];
    assert.equal(listing.status, "published");
    assert.ok(stay.guests >= 1 && stay.guests <= listing.maxGuests);
    assert.ok(stay.nights >= 1 && stay.nights <= 28);
    const nights = byListing.get(stay.listingIndex) ?? new Set<number>();
    for (
      let day = stay.checkInOffset;
      day < stay.checkInOffset + stay.nights;
      day += 1
    ) {
      assert.ok(!nights.has(day), `overlap on listing ${stay.listingIndex}`);
      nights.add(day);
      if (stay.kind === "upcoming") {
        assert.ok(day > 0);
        assert.ok(!(seedBlockedDayOffsets as readonly number[]).includes(day));
        assert.ok(
          !(seedPriceOverrideDayOffsets as readonly number[]).includes(day),
        );
      }
    }
    byListing.set(stay.listingIndex, nights);
    if (stay.kind === "completed") {
      // Reviews are revealed, so the 14-day review window must have closed.
      assert.ok(stay.checkInOffset + stay.nights <= -15);
      assert.ok(stay.review);
    }
  }
  assert.ok(stays.filter((stay) => stay.kind === "completed").length >= 60);
  assert.ok(stays.some((stay) => stay.kind === "upcoming"));
  assert.equal(stayDates("2027-01-01", "2027-01-04").length, 3);
});
