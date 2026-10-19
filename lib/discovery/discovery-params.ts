import type {
  BookingMode,
  PropertyType,
  SearchInput,
  SearchSort,
} from "../search/search-contract";
import { seededDestinations } from "../search/seeded-destinations";

/**
 * Discovery filters as they live in the URL. Prices are whole dollars here and
 * cents in the search contract; everything else maps one-to-one.
 */
export type DiscoveryFilters = {
  where?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  category?: string;
  type?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  amenities: string[];
  mode?: BookingMode;
  sort?: SearchSort;
  near?: { latitude: number; longitude: number };
  /** Small-screen results view; list is the default and stays out of the URL. */
  view?: "map";
};

type ReadableParams = { get(name: string): string | null };

const propertyTypes: readonly PropertyType[] = [
  "entire_home",
  "private_room",
  "shared_room",
];
const bookingModes: readonly BookingMode[] = ["instant", "request"];
const sorts: readonly SearchSort[] = ["rating", "price", "distance"];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function text(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function wholeNumber(value: string | null, minimum: number) {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : undefined;
}

function oneOf<T extends string>(value: string | null, options: readonly T[]) {
  return options.find((option) => option === value);
}

function coordinates(value: string | null) {
  if (!value) return undefined;
  const [latitude, longitude] = value.split(",").map(Number);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return undefined;
  }
  return { latitude, longitude };
}

function nightsBetween(checkIn: string, checkOut: string) {
  return (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000;
}

/** Reads filters from the URL, dropping anything malformed instead of failing. */
export function parseDiscoveryParams(params: ReadableParams): DiscoveryFilters {
  let checkIn = text(params.get("checkIn"));
  let checkOut = text(params.get("checkOut"));
  const validDates =
    checkIn !== undefined &&
    checkOut !== undefined &&
    isoDate.test(checkIn) &&
    isoDate.test(checkOut) &&
    Number.isInteger(nightsBetween(checkIn, checkOut)) &&
    nightsBetween(checkIn, checkOut) >= 1 &&
    nightsBetween(checkIn, checkOut) <= 28;
  if (!validDates) {
    checkIn = undefined;
    checkOut = undefined;
  }

  let minPrice = wholeNumber(params.get("minPrice"), 0);
  let maxPrice = wholeNumber(params.get("maxPrice"), 0);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const where = text(params.get("where"));
  const near = coordinates(params.get("near"));
  let sort = oneOf(params.get("sort"), sorts);
  if (sort === "distance" && !near && !seededOrigin(where)) sort = undefined;

  return {
    where,
    checkIn,
    checkOut,
    guests: wholeNumber(params.get("guests"), 1),
    category: text(params.get("category")),
    type: oneOf(params.get("type"), propertyTypes),
    minPrice,
    maxPrice,
    amenities: [
      ...new Set(
        (params.get("amenities") ?? "")
          .split(",")
          .map((amenity) => amenity.trim())
          .filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right)),
    mode: oneOf(params.get("mode"), bookingModes),
    sort,
    near,
    view: oneOf(params.get("view"), ["map"] as const),
  };
}

/** Serializes filters into a stable query string (empty values omitted). */
export function serializeDiscoveryParams(filters: DiscoveryFilters) {
  const params = new URLSearchParams();
  const set = (name: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(name, String(value));
  };
  set("where", filters.where);
  if (filters.checkIn && filters.checkOut) {
    set("checkIn", filters.checkIn);
    set("checkOut", filters.checkOut);
  }
  set("guests", filters.guests);
  set("category", filters.category);
  set("type", filters.type);
  set("minPrice", filters.minPrice);
  set("maxPrice", filters.maxPrice);
  if (filters.amenities.length > 0) {
    set("amenities", filters.amenities.join(","));
  }
  set("mode", filters.mode);
  set("sort", filters.sort);
  if (filters.near) {
    set(
      "near",
      `${filters.near.latitude.toFixed(4)},${filters.near.longitude.toFixed(4)}`,
    );
  }
  set("view", filters.view);
  return params.toString();
}

export function seededOrigin(where: string | undefined) {
  if (!where) return undefined;
  const match = seededDestinations.find(
    (destination) =>
      destination.city.toLocaleLowerCase("en-US") ===
      where.toLocaleLowerCase("en-US"),
  );
  return match
    ? { latitude: match.latitude, longitude: match.longitude }
    : undefined;
}

/** Converts URL filters into the backend search contract input. */
export function toSearchInput(filters: DiscoveryFilters): SearchInput {
  const origin = filters.near ?? seededOrigin(filters.where);
  return {
    destination: filters.where,
    checkIn: filters.checkIn,
    checkOut: filters.checkOut,
    guests: filters.guests,
    category: filters.category,
    propertyType: filters.type,
    minNightlyPriceCents:
      filters.minPrice === undefined ? undefined : filters.minPrice * 100,
    maxNightlyPriceCents:
      filters.maxPrice === undefined ? undefined : filters.maxPrice * 100,
    amenities: filters.amenities.length > 0 ? filters.amenities : undefined,
    bookingMode: filters.mode,
    sort: filters.sort,
    origin,
  };
}

/** Number of refinements applied beyond destination, dates, guests, category. */
export function countRefinements(filters: DiscoveryFilters) {
  return (
    (filters.type ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    filters.amenities.length +
    (filters.mode ? 1 : 0) +
    (filters.sort && filters.sort !== "rating" ? 1 : 0)
  );
}
