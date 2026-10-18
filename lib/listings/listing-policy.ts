export type ListingStatus = "draft" | "published" | "archived";

export type ListingPolicyErrorCode =
  | "INVALID_LISTING_STATUS_TRANSITION"
  | "LISTING_ARCHIVED"
  | "LISTING_NOT_DELETABLE"
  | "LISTING_NOT_PUBLISHABLE";

export class ListingPolicyError extends Error {
  constructor(public readonly code: ListingPolicyErrorCode) {
    super(code);
    this.name = "ListingPolicyError";
  }
}

const validTransitions: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: [],
};

export function assertListingStatusTransition(
  currentStatus: ListingStatus,
  nextStatus: ListingStatus,
) {
  if (currentStatus === "archived") {
    throw new ListingPolicyError("LISTING_ARCHIVED");
  }

  if (!validTransitions[currentStatus].includes(nextStatus)) {
    throw new ListingPolicyError("INVALID_LISTING_STATUS_TRANSITION");
  }
}

export function assertListingCanBeDeleted(
  status: ListingStatus,
  hasBeenPublished: boolean,
) {
  if (status !== "draft" || hasBeenPublished) {
    throw new ListingPolicyError("LISTING_NOT_DELETABLE");
  }
}

export function assertListingCanBePublished(listing: {
  title: string;
  maxGuests: number;
  nightlyPriceCents: number;
  timezone: string;
}) {
  const timezoneIsValid = (() => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: listing.timezone });
      return true;
    } catch {
      return false;
    }
  })();

  if (
    listing.title.trim().length === 0 ||
    listing.maxGuests < 1 ||
    listing.nightlyPriceCents < 1 ||
    !timezoneIsValid
  ) {
    throw new ListingPolicyError("LISTING_NOT_PUBLISHABLE");
  }
}

export function isValidStayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
