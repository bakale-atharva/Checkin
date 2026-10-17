import assert from "node:assert/strict";
import test from "node:test";

import {
  SEARCH_PAGE_SIZE,
  SearchValidationError,
  buildSearchSnapshot,
  normalizeSearchInput,
  pageSnapshotIds,
} from "./search-contract";

const baseListing = {
  _id: "listing-a",
  title: "Design loft in Lisbon",
  city: "Lisbon",
  countryCode: "PT",
  latitude: 38.72,
  longitude: -9.14,
  nightlyPriceCents: 12_000,
  publishedRating: 4.8,
  maxGuests: 4,
  category: "Design stays",
  propertyType: "entire_home" as const,
  amenities: ["Wifi", "Kitchen"],
  bookingMode: "instant" as const,
};

test("normalizes destination matching and validates a one-to-twenty-eight-night search", () => {
  const input = normalizeSearchInput({
    destination: "  LISBON ",
    checkIn: "2027-01-10",
    checkOut: "2027-01-13",
    guests: 2,
    amenities: ["Kitchen", "Wifi", "Kitchen"],
    sort: "price",
  });

  assert.equal(input.destination, "lisbon");
  assert.deepEqual(input.amenities, ["Kitchen", "Wifi"]);
  assert.equal(input.sort, "price");
});

test("rejects searches longer than twenty-eight nights", () => {
  assert.throws(
    () =>
      normalizeSearchInput({ checkIn: "2027-01-01", checkOut: "2027-01-30" }),
    SearchValidationError,
  );
});

test("creates a shared cards-and-pins snapshot after filtering unavailable listings", () => {
  const snapshot = buildSearchSnapshot(
    [
      baseListing,
      {
        ...baseListing,
        _id: "listing-b",
        nightlyPriceCents: 9_000,
        maxGuests: 2,
      },
      {
        ...baseListing,
        _id: "listing-c",
        amenities: ["Wifi"],
        nightlyPriceCents: 8_000,
      },
    ],
    normalizeSearchInput({
      destination: "Lisbon",
      guests: 2,
      amenities: ["Kitchen"],
      minNightlyPriceCents: 8_000,
      maxNightlyPriceCents: 12_000,
      sort: "price",
    }),
    new Set(["listing-b"]),
  );

  assert.deepEqual(snapshot.listingIds, ["listing-a"]);
  assert.deepEqual(
    snapshot.results.map((result) => result.listingId),
    ["listing-a"],
  );
  assert.equal(snapshot.results[0]?.nightlyPriceCents, 12_000);
  assert.equal(snapshot.contractVersion, 1);
});

test("uses deterministic ties and returns non-overlapping pages of twenty-four", () => {
  const listings = Array.from({ length: 30 }, (_, index) => ({
    ...baseListing,
    _id: `listing-${String(30 - index).padStart(2, "0")}`,
    nightlyPriceCents: 10_000,
  }));
  const snapshot = buildSearchSnapshot(
    listings,
    normalizeSearchInput({ sort: "price" }),
    new Set(),
  );

  const first = pageSnapshotIds(snapshot.listingIds, 0);
  const second = pageSnapshotIds(snapshot.listingIds, first.nextOffset);

  assert.equal(first.listingIds.length, SEARCH_PAGE_SIZE);
  assert.equal(second.listingIds.length, 6);
  assert.equal(new Set([...first.listingIds, ...second.listingIds]).size, 30);
  assert.deepEqual(first.listingIds.slice(0, 3), [
    "listing-01",
    "listing-02",
    "listing-03",
  ]);
});

test("sorts by distance then stable listing id", () => {
  const snapshot = buildSearchSnapshot(
    [
      { ...baseListing, _id: "listing-z", latitude: 38.73, longitude: -9.14 },
      { ...baseListing, _id: "listing-a", latitude: 38.73, longitude: -9.14 },
      { ...baseListing, _id: "listing-b", latitude: 38.721, longitude: -9.14 },
    ],
    normalizeSearchInput({
      sort: "distance",
      origin: { latitude: 38.72, longitude: -9.14 },
    }),
    new Set(),
  );

  assert.deepEqual(snapshot.listingIds, [
    "listing-b",
    "listing-a",
    "listing-z",
  ]);
});
