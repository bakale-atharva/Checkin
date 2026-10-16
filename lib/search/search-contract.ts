export const SEARCH_PAGE_SIZE = 24;
export const MAX_SEARCH_CANDIDATES = 500;
export const SEARCH_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export type SearchSort = "price" | "rating" | "distance";
export type PropertyType = "entire_home" | "private_room" | "shared_room";
export type BookingMode = "instant" | "request";

export type SearchInput = {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  category?: string;
  propertyType?: PropertyType;
  minNightlyPriceCents?: number;
  maxNightlyPriceCents?: number;
  amenities?: string[];
  bookingMode?: BookingMode;
  sort?: SearchSort;
  origin?: { latitude: number; longitude: number };
};

export type NormalizedSearchInput = SearchInput & {
  amenities: string[];
  sort: SearchSort;
};

export type SearchableListing = {
  _id: string;
  title: string;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  nightlyPriceCents: number;
  publishedRating: number;
  maxGuests: number;
  category: string;
  propertyType: PropertyType;
  amenities: string[];
  bookingMode: BookingMode;
};

export type SearchSnapshot = {
  contractVersion: 1;
  listingIds: string[];
  results: Array<Omit<SearchableListing, "_id"> & { listingId: string }>;
};

export class SearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchValidationError";
  }
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function assertInteger(value: number, label: string, minimum: number) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new SearchValidationError(`${label} must be an integer of at least ${minimum}.`);
  }
}

function dateFromIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SearchValidationError("Dates must use YYYY-MM-DD format.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new SearchValidationError("Dates must be real calendar dates.");
  }
  return date;
}

function assertCoordinates(coordinates: { latitude: number; longitude: number }) {
  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    throw new SearchValidationError("Origin coordinates are invalid.");
  }
}

export function normalizeSearchInput(input: SearchInput): NormalizedSearchInput {
  if ((input.checkIn === undefined) !== (input.checkOut === undefined)) {
    throw new SearchValidationError("Check-in and check-out must be supplied together.");
  }

  if (input.checkIn && input.checkOut) {
    const checkIn = dateFromIso(input.checkIn);
    const checkOut = dateFromIso(input.checkOut);
    const nights = (checkOut.getTime() - checkIn.getTime()) / 86_400_000;
    if (!Number.isInteger(nights) || nights < 1 || nights > 28) {
      throw new SearchValidationError("Stays must be between one and twenty-eight nights.");
    }
  }

  if (input.guests !== undefined) assertInteger(input.guests, "Guests", 1);
  if (input.minNightlyPriceCents !== undefined) {
    assertInteger(input.minNightlyPriceCents, "Minimum nightly price", 0);
  }
  if (input.maxNightlyPriceCents !== undefined) {
    assertInteger(input.maxNightlyPriceCents, "Maximum nightly price", 0);
  }
  if (
    input.minNightlyPriceCents !== undefined &&
    input.maxNightlyPriceCents !== undefined &&
    input.minNightlyPriceCents > input.maxNightlyPriceCents
  ) {
    throw new SearchValidationError("Minimum nightly price cannot exceed maximum nightly price.");
  }
  if (input.origin) assertCoordinates(input.origin);

  const sort = input.sort ?? "rating";
  if (sort === "distance" && !input.origin) {
    throw new SearchValidationError("Distance sorting requires an origin.");
  }

  return {
    ...input,
    destination: input.destination ? normalizeText(input.destination) : undefined,
    category: input.category ? normalizeText(input.category) : undefined,
    amenities: [...new Set((input.amenities ?? []).map((amenity) => amenity.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    sort,
  };
}

function distanceKm(
  origin: { latitude: number; longitude: number },
  listing: SearchableListing,
) {
  const latitudeRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = latitudeRadians(listing.latitude - origin.latitude);
  const longitudeDelta = latitudeRadians(listing.longitude - origin.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeRadians(origin.latitude)) *
      Math.cos(latitudeRadians(listing.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesFilters(listing: SearchableListing, input: NormalizedSearchInput) {
  if (input.destination && normalizeText(listing.city) !== input.destination) return false;
  if (input.guests !== undefined && listing.maxGuests < input.guests) return false;
  if (input.category && normalizeText(listing.category) !== input.category) return false;
  if (input.propertyType && listing.propertyType !== input.propertyType) return false;
  if (
    input.minNightlyPriceCents !== undefined &&
    listing.nightlyPriceCents < input.minNightlyPriceCents
  ) {
    return false;
  }
  if (
    input.maxNightlyPriceCents !== undefined &&
    listing.nightlyPriceCents > input.maxNightlyPriceCents
  ) {
    return false;
  }
  if (input.bookingMode && listing.bookingMode !== input.bookingMode) return false;
  const listingAmenities = new Set(listing.amenities.map(normalizeText));
  return input.amenities.every((amenity) => listingAmenities.has(normalizeText(amenity)));
}

function compareListings(
  left: SearchableListing,
  right: SearchableListing,
  input: NormalizedSearchInput,
) {
  let comparison = 0;
  if (input.sort === "price") {
    comparison = left.nightlyPriceCents - right.nightlyPriceCents;
  } else if (input.sort === "rating") {
    comparison = right.publishedRating - left.publishedRating;
  } else if (input.origin) {
    comparison = distanceKm(input.origin, left) - distanceKm(input.origin, right);
  }
  return comparison || left._id.localeCompare(right._id);
}

export function buildSearchSnapshot(
  candidates: SearchableListing[],
  input: NormalizedSearchInput,
  unavailableListingIds: Set<string>,
): SearchSnapshot {
  if (candidates.length > MAX_SEARCH_CANDIDATES) {
    throw new SearchValidationError("Search is too broad. Choose a narrower destination or filters.");
  }

  const results = candidates
    .filter((listing) => !unavailableListingIds.has(listing._id))
    .filter((listing) => matchesFilters(listing, input))
    .sort((left, right) => compareListings(left, right, input))
    .map(({ _id, ...listing }) => ({ listingId: _id, ...listing }));

  return { contractVersion: 1, listingIds: results.map((result) => result.listingId), results };
}

export function pageSnapshotIds(listingIds: string[], offset: number) {
  assertInteger(offset, "Offset", 0);
  const page = listingIds.slice(offset, offset + SEARCH_PAGE_SIZE);
  const nextOffset = offset + page.length;
  return {
    listingIds: page,
    nextOffset,
    isDone: nextOffset >= listingIds.length,
  };
}
