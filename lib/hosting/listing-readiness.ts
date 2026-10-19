export const wizardSteps = [
  { id: "basics", label: "Basics" },
  { id: "location", label: "Location" },
  { id: "capacity", label: "Capacity" },
  { id: "amenities", label: "Amenities & rules" },
  { id: "photos", label: "Photos" },
  { id: "pricing", label: "Pricing & booking" },
  { id: "review", label: "Review & publish" },
] as const;

export type WizardStepId = (typeof wizardSteps)[number]["id"];

export function parseWizardStep(value: string | null | undefined) {
  return wizardSteps.find((step) => step.id === value)?.id ?? wizardSteps[0].id;
}

export function adjacentWizardStep(current: WizardStepId, offset: 1 | -1) {
  const index = wizardSteps.findIndex((step) => step.id === current);
  return wizardSteps[index + offset]?.id ?? null;
}

export type ReadinessInput = {
  title: string;
  description: string;
  category: string;
  maxGuests: number;
  nightlyPriceCents: number;
  timezone: string;
  privateAddress: { line1: string; city: string; countryCode: string };
  publicLocation: {
    city: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  };
  photoCount: number;
};

export type ReadinessIssue = { step: WizardStepId; message: string };

function isValidTimezone(timezone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Everything a host still has to finish before a listing can be published.
 * The server re-checks the essentials; this list explains them up front.
 */
export function listingReadinessIssues(
  listing: ReadinessInput,
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const title = listing.title.trim();
  if (!title || title === "Untitled stay")
    issues.push({ step: "basics", message: "Give the stay a title." });
  if (!listing.description.trim())
    issues.push({ step: "basics", message: "Describe the stay." });
  if (!listing.category.trim())
    issues.push({ step: "basics", message: "Choose a category." });
  if (
    !listing.privateAddress.line1.trim() ||
    !listing.privateAddress.city.trim() ||
    !listing.privateAddress.countryCode.trim()
  )
    issues.push({ step: "location", message: "Add the street address." });
  if (
    !listing.publicLocation.city.trim() ||
    !listing.publicLocation.countryCode.trim() ||
    (listing.publicLocation.latitude === 0 &&
      listing.publicLocation.longitude === 0)
  )
    issues.push({ step: "location", message: "Place the map pin." });
  if (!isValidTimezone(listing.timezone) || listing.timezone === "UTC")
    issues.push({ step: "location", message: "Pick the local timezone." });
  if (listing.maxGuests < 1)
    issues.push({ step: "capacity", message: "Allow at least one guest." });
  if (listing.photoCount < 1)
    issues.push({ step: "photos", message: "Upload at least one photo." });
  if (listing.nightlyPriceCents < 1)
    issues.push({ step: "pricing", message: "Set a nightly price." });
  return issues;
}

/** Parses a dollar amount typed by a host into whole cents, or null if invalid. */
export function parseDollarsToCents(value: string) {
  const trimmed = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToDollarInput(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
