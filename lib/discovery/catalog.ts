import type {
  BookingMode,
  PropertyType,
  SearchSort,
} from "../search/search-contract";

/** Category pills. `value` must match a listing's category (case-insensitive). */
export const discoveryCategories = [
  { value: "Design stays", label: "Design stays", icon: "sparkles" },
  { value: "Countryside", label: "Countryside", icon: "trees" },
  { value: "Beachfront", label: "Beachfront", icon: "waves" },
  { value: "Cabins", label: "Cabins", icon: "mountain" },
  { value: "City stays", label: "City stays", icon: "building" },
  { value: "Tiny homes", label: "Tiny homes", icon: "tent" },
] as const;

export type CategoryIcon = (typeof discoveryCategories)[number]["icon"];

export const discoveryAmenities = [
  "Wifi",
  "Kitchen",
  "Workspace",
  "Washer",
  "Air conditioning",
  "Free parking",
  "Pool",
  "Hot tub",
] as const;

export const propertyTypeLabels: Record<PropertyType, string> = {
  entire_home: "Entire home",
  private_room: "Private room",
  shared_room: "Shared room",
};

export const bookingModeLabels: Record<BookingMode, string> = {
  instant: "Instant book",
  request: "Request to book",
};

export const sortLabels: Record<SearchSort, string> = {
  rating: "Top rated",
  price: "Lowest price",
  distance: "Nearest",
};

export function formatNightlyPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
