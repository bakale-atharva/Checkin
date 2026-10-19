"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, ChevronLeft, CircleAlert, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  bookingModeLabels,
  discoveryAmenities,
  discoveryCategories,
  formatNightlyPrice,
  propertyTypeLabels,
} from "@/lib/discovery/catalog";
import {
  adjacentWizardStep,
  centsToDollarInput,
  listingReadinessIssues,
  parseDollarsToCents,
  parseWizardStep,
  wizardSteps,
  type WizardStepId,
} from "@/lib/hosting/listing-readiness";
import { cn } from "@/lib/utils";
import {
  Field,
  Select,
  Stepper,
  TextArea,
  TextInput,
  errorMessage,
} from "./form-controls";
import { LocationPinPicker } from "./location-pin-picker";
import { PhotoManager } from "./photo-manager";
import { ListingStatusBadge } from "./listing-status-badge";
import { useHostAllowance } from "./use-host-allowance";

type Listing = Doc<"listings">;

/** Editable copy of a listing; prices are kept as typed dollar strings. */
type Draft = {
  title: string;
  description: string;
  propertyType: Listing["propertyType"];
  category: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  rules: string[];
  privateAddress: Listing["privateAddress"];
  latitude: string;
  longitude: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  nightlyPrice: string;
  cleaningFee: string;
  bookingMode: Listing["bookingMode"];
};

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function toDraft(listing: Listing): Draft {
  const hasPin =
    listing.publicLocation.latitude !== 0 ||
    listing.publicLocation.longitude !== 0;
  return {
    title: listing.title === "Untitled stay" ? "" : listing.title,
    description: listing.description,
    propertyType: listing.propertyType,
    category: listing.category,
    maxGuests: listing.maxGuests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    amenities: listing.amenities,
    rules: listing.rules,
    privateAddress: listing.privateAddress,
    latitude: hasPin ? String(listing.publicLocation.latitude) : "",
    longitude: hasPin ? String(listing.publicLocation.longitude) : "",
    timezone: listing.timezone === "UTC" ? browserTimezone() : listing.timezone,
    checkInTime: listing.checkInTime,
    checkOutTime: listing.checkOutTime,
    nightlyPrice: listing.nightlyPriceCents
      ? centsToDollarInput(listing.nightlyPriceCents)
      : "",
    cleaningFee: centsToDollarInput(listing.cleaningFeeCents),
    bookingMode: listing.bookingMode,
  };
}

/** Rounds a pin to about a kilometre so guests only ever see the area. */
function approximate(value: number) {
  return Math.round(value * 100) / 100;
}

function parseCoordinate(value: string, limit: number) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

type StepResult = { fields: Record<string, unknown> } | { error: string };

function stepFields(step: WizardStepId, draft: Draft): StepResult | null {
  switch (step) {
    case "basics": {
      if (draft.title.trim().length > 80)
        return { error: "Keep the title under 80 characters." };
      return {
        fields: {
          title: draft.title.trim() || "Untitled stay",
          description: draft.description.trim(),
          propertyType: draft.propertyType,
          category: draft.category,
        },
      };
    }
    case "location": {
      const latitude = parseCoordinate(draft.latitude, 90);
      const longitude = parseCoordinate(draft.longitude, 180);
      if (
        (draft.latitude || draft.longitude) &&
        (latitude === null || longitude === null)
      )
        return {
          error:
            "Latitude must be between −90 and 90, longitude between −180 and 180.",
        };
      const address = {
        line1: draft.privateAddress.line1.trim(),
        line2: draft.privateAddress.line2?.trim() || undefined,
        city: draft.privateAddress.city.trim(),
        region: draft.privateAddress.region?.trim() || undefined,
        postalCode: draft.privateAddress.postalCode.trim(),
        countryCode: draft.privateAddress.countryCode.trim().toUpperCase(),
      };
      return {
        fields: {
          privateAddress: address,
          publicLocation: {
            city: address.city,
            region: address.region,
            countryCode: address.countryCode,
            latitude: approximate(latitude ?? 0),
            longitude: approximate(longitude ?? 0),
          },
          timezone: draft.timezone,
        },
      };
    }
    case "capacity":
      return {
        fields: {
          maxGuests: draft.maxGuests,
          bedrooms: draft.bedrooms,
          beds: draft.beds,
          bathrooms: draft.bathrooms,
        },
      };
    case "amenities":
      return { fields: { amenities: draft.amenities, rules: draft.rules } };
    case "pricing": {
      const nightly = draft.nightlyPrice.trim()
        ? parseDollarsToCents(draft.nightlyPrice)
        : 0;
      const cleaning = draft.cleaningFee.trim()
        ? parseDollarsToCents(draft.cleaningFee)
        : 0;
      if (nightly === null || cleaning === null)
        return { error: "Enter prices as dollar amounts, like 180 or 45.50." };
      return {
        fields: {
          nightlyPriceCents: nightly,
          cleaningFeeCents: cleaning,
          bookingMode: draft.bookingMode,
          checkInTime: draft.checkInTime,
          checkOutTime: draft.checkOutTime,
        },
      };
    }
    default:
      return null;
  }
}

export function ListingWizard() {
  const { listingId } = useParams<{ listingId: Id<"listings"> }>();
  const profileReady = useProfileReady();
  const data = useQuery(
    api.listings.getOwned,
    profileReady ? { listingId } : "skip",
  );

  if (data === undefined) {
    return (
      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-checkin-muted">Loading listing…</p>
      </main>
    );
  }
  return <WizardForm key={data.listing._id} data={data} />;
}

function WizardForm({
  data,
}: {
  data: {
    listing: Listing;
    photos: {
      _id: Id<"listingPhotos">;
      url: string | null;
      altText?: string;
      position: number;
    }[];
  };
}) {
  const { listing, photos } = data;
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = parseWizardStep(searchParams.get("step"));
  const update = useMutation(api.listings.update);
  const [draft, setDraft] = useState<Draft>(() => toDraft(listing));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const readOnly = listing.status === "archived";

  const edit = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  async function save() {
    if (!dirty || readOnly) return true;
    const result = stepFields(step, draft);
    if (!result) return true;
    if ("error" in result) {
      setError(result.error);
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await update({
        listingId: listing._id,
        fields: result.fields as Parameters<typeof update>[0]["fields"],
      });
      setDirty(false);
      setSaved(true);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't save your changes."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(next: WizardStepId | null) {
    if (!(await save()) || !next) return;
    router.replace(`/hosting/listings/${listing._id}?step=${next}`, {
      scroll: false,
    });
    window.scrollTo({ top: 0 });
  }

  const stepIndex = wizardSteps.findIndex((item) => item.id === step);
  const next = adjacentWizardStep(step, 1);
  const previous = adjacentWizardStep(step, -1);

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/hosting"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-checkin-muted hover:text-checkin-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All listings
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
          {listing.title === "Untitled stay" ? "New listing" : listing.title}
        </h1>
        <ListingStatusBadge listing={listing} />
      </div>
      <p className="mt-1 text-sm text-checkin-muted" aria-live="polite">
        {saving
          ? "Saving draft…"
          : dirty
            ? "Unsaved changes"
            : saved
              ? "Draft saved"
              : "Changes save when you continue to the next step."}
      </p>

      {readOnly ? (
        <p className="mt-6 rounded-[0.9rem] border border-checkin-line bg-checkin-mist/40 px-4 py-3 text-sm">
          This listing is archived. Its details and booking history are kept,
          but it can no longer be edited or published.
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Listing steps">
          <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible">
            {wizardSteps.map((item, index) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => void goTo(item.id)}
                  aria-current={item.id === step ? "step" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-[0.7rem] px-3 text-left text-sm font-semibold whitespace-nowrap transition-colors hover:bg-checkin-mist/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35",
                    item.id === step
                      ? "bg-checkin-mist/70 text-checkin-ink"
                      : "text-checkin-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 place-items-center rounded-full border text-xs",
                      index < stepIndex
                        ? "border-checkin-ink bg-checkin-ink text-checkin-canvas"
                        : "border-checkin-line",
                    )}
                  >
                    {index < stepIndex ? (
                      <Check className="size-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <Surface className="@container/wizard p-5 sm:p-8">
          <fieldset disabled={readOnly || saving} className="min-w-0">
            <legend className="text-xl font-semibold tracking-[-0.03em]">
              {wizardSteps[stepIndex]?.label}
            </legend>
            <div className="mt-6">
              {step === "basics" ? (
                <BasicsStep draft={draft} edit={edit} />
              ) : step === "location" ? (
                <LocationStep draft={draft} edit={edit} />
              ) : step === "capacity" ? (
                <CapacityStep draft={draft} edit={edit} />
              ) : step === "amenities" ? (
                <AmenitiesStep draft={draft} edit={edit} />
              ) : step === "photos" ? (
                <PhotoManager
                  listingId={listing._id}
                  photos={photos}
                  coverPhotoId={listing.coverPhotoId}
                />
              ) : step === "pricing" ? (
                <PricingStep draft={draft} edit={edit} />
              ) : (
                <ReviewStep
                  listing={listing}
                  photoCount={photos.length}
                  onFix={(target) => void goTo(target)}
                />
              )}
            </div>
          </fieldset>

          {error ? (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2 text-sm font-medium text-checkin-signal"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-checkin-line pt-6">
            <Button
              type="button"
              variant="outline"
              disabled={!previous || saving}
              onClick={() => void goTo(previous)}
            >
              Back
            </Button>
            {next ? (
              <Button
                type="button"
                disabled={saving}
                onClick={() => void goTo(next)}
              >
                {readOnly ? "Next" : "Save and continue"}
              </Button>
            ) : null}
          </div>
        </Surface>
      </div>
    </main>
  );
}

type StepProps = { draft: Draft; edit: (patch: Partial<Draft>) => void };

function BasicsStep({ draft, edit }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Title"
        htmlFor="title"
        hint="Short and specific — up to 80 characters."
      >
        <TextInput
          id="title"
          value={draft.title}
          maxLength={80}
          placeholder="Sunlit loft above the harbor"
          onChange={(event) => edit({ title: event.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor="description">
        <TextArea
          id="description"
          value={draft.description}
          maxLength={2000}
          placeholder="What makes the space comfortable, and what's nearby?"
          onChange={(event) => edit({ description: event.target.value })}
        />
      </Field>
      <div className="grid gap-5 @lg/wizard:grid-cols-2">
        <Field label="Property type" htmlFor="property-type">
          <Select
            id="property-type"
            value={draft.propertyType}
            onChange={(event) =>
              edit({
                propertyType: event.target.value as Draft["propertyType"],
              })
            }
          >
            {Object.entries(propertyTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="category">
          <Select
            id="category"
            value={draft.category}
            onChange={(event) => edit({ category: event.target.value })}
          >
            <option value="">Choose a category</option>
            {discoveryCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

function LocationStep({ draft, edit }: StepProps) {
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [draft.timezone];
    }
  }, [draft.timezone]);
  const address = draft.privateAddress;
  const setAddress = (patch: Partial<Draft["privateAddress"]>) =>
    edit({ privateAddress: { ...address, ...patch } });
  const pin = {
    latitude: Number(draft.latitude) || 0,
    longitude: Number(draft.longitude) || 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="address-heading"
        className="flex flex-col gap-4"
      >
        <div>
          <h2 id="address-heading" className="font-semibold">
            Street address
          </h2>
          <p className="text-sm text-checkin-muted">
            Kept private. Guests only see the city and an approximate pin.
          </p>
        </div>
        <Field label="Address line 1" htmlFor="line1">
          <TextInput
            id="line1"
            autoComplete="address-line1"
            value={address.line1}
            onChange={(event) => setAddress({ line1: event.target.value })}
          />
        </Field>
        <Field label="Address line 2 (optional)" htmlFor="line2">
          <TextInput
            id="line2"
            autoComplete="address-line2"
            value={address.line2 ?? ""}
            onChange={(event) => setAddress({ line2: event.target.value })}
          />
        </Field>
        <div className="grid gap-4 @lg/wizard:grid-cols-2">
          <Field label="City" htmlFor="city">
            <TextInput
              id="city"
              autoComplete="address-level2"
              value={address.city}
              onChange={(event) => setAddress({ city: event.target.value })}
            />
          </Field>
          <Field label="State or region (optional)" htmlFor="region">
            <TextInput
              id="region"
              autoComplete="address-level1"
              value={address.region ?? ""}
              onChange={(event) => setAddress({ region: event.target.value })}
            />
          </Field>
          <Field label="Postal code" htmlFor="postal-code">
            <TextInput
              id="postal-code"
              autoComplete="postal-code"
              value={address.postalCode}
              onChange={(event) =>
                setAddress({ postalCode: event.target.value })
              }
            />
          </Field>
          <Field
            label="Country code"
            htmlFor="country"
            hint="Two letters, like US or PT."
          >
            <TextInput
              id="country"
              autoComplete="country"
              maxLength={2}
              value={address.countryCode}
              onChange={(event) =>
                setAddress({ countryCode: event.target.value.toUpperCase() })
              }
            />
          </Field>
        </div>
      </section>

      <section aria-labelledby="pin-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="pin-heading" className="font-semibold">
            Map pin
          </h2>
          <p className="text-sm text-checkin-muted">
            Click the map to drop the pin, then drag to adjust. It&apos;s
            rounded to about a kilometre before guests see it.
          </p>
        </div>
        <LocationPinPicker
          pin={pin}
          onChange={(next) =>
            edit({
              latitude: next.latitude.toFixed(5),
              longitude: next.longitude.toFixed(5),
            })
          }
        />
        <div className="grid gap-4 @lg/wizard:grid-cols-2">
          <Field label="Latitude" htmlFor="latitude">
            <TextInput
              id="latitude"
              inputMode="decimal"
              value={draft.latitude}
              placeholder="38.7223"
              onChange={(event) => edit({ latitude: event.target.value })}
            />
          </Field>
          <Field label="Longitude" htmlFor="longitude">
            <TextInput
              id="longitude"
              inputMode="decimal"
              value={draft.longitude}
              placeholder="-9.1393"
              onChange={(event) => edit({ longitude: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <Field
        label="Local timezone"
        htmlFor="timezone"
        hint="Check-in dates and cancellation deadlines use this timezone."
      >
        <Select
          id="timezone"
          value={draft.timezone}
          onChange={(event) => edit({ timezone: event.target.value })}
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function CapacityStep({ draft, edit }: StepProps) {
  return (
    <div className="divide-y divide-checkin-line">
      <Stepper
        id="max-guests"
        label="Guests"
        value={draft.maxGuests}
        min={1}
        max={16}
        onChange={(maxGuests) => edit({ maxGuests })}
      />
      <Stepper
        id="bedrooms"
        label="Bedrooms"
        value={draft.bedrooms}
        min={0}
        max={20}
        onChange={(bedrooms) => edit({ bedrooms })}
      />
      <Stepper
        id="beds"
        label="Beds"
        value={draft.beds}
        min={0}
        max={30}
        onChange={(beds) => edit({ beds })}
      />
      <Stepper
        id="bathrooms"
        label="Bathrooms"
        value={draft.bathrooms}
        min={0}
        max={20}
        step={0.5}
        onChange={(bathrooms) => edit({ bathrooms })}
      />
    </div>
  );
}

function ListEditor({
  id,
  label,
  placeholder,
  items,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const item = value.trim();
    if (!item || items.includes(item) || items.length >= 30) return;
    onChange([...items, item]);
    setValue("");
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label={label} htmlFor={id}>
        <div className="flex gap-2">
          <TextInput
            id={id}
            value={value}
            maxLength={120}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add}>
            <Plus aria-hidden className="size-4" />
            Add
          </Button>
        </div>
      </Field>
      {items.length ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-checkin-mist/70 py-1 pr-1 pl-3 text-sm"
            >
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="grid size-7 place-items-center rounded-full hover:bg-checkin-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
                onClick={() =>
                  onChange(items.filter((other) => other !== item))
                }
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AmenitiesStep({ draft, edit }: StepProps) {
  const catalog = discoveryAmenities as readonly string[];
  const extras = draft.amenities.filter((item) => !catalog.includes(item));
  const toggle = (amenity: string) =>
    edit({
      amenities: draft.amenities.includes(amenity)
        ? draft.amenities.filter((item) => item !== amenity)
        : [...draft.amenities, amenity],
    });

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="font-semibold">Amenities</legend>
        <p className="text-sm text-checkin-muted">
          These are the amenities guests can filter by.
        </p>
        <div className="mt-3 grid gap-2 @md/wizard:grid-cols-2">
          {catalog.map((amenity) => (
            <label
              key={amenity}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.7rem] border border-checkin-line px-3 has-checked:border-checkin-ink has-checked:bg-checkin-mist/40"
            >
              <input
                type="checkbox"
                className="size-4 accent-checkin-ink"
                checked={draft.amenities.includes(amenity)}
                onChange={() => toggle(amenity)}
              />
              <span className="text-sm font-medium">{amenity}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <ListEditor
        id="extra-amenity"
        label="Other amenities"
        placeholder="Record player"
        items={extras}
        onChange={(next) =>
          edit({
            amenities: [
              ...draft.amenities.filter((item) => catalog.includes(item)),
              ...next,
            ],
          })
        }
      />
      <ListEditor
        id="house-rule"
        label="House rules"
        placeholder="No parties or events"
        items={draft.rules}
        onChange={(rules) => edit({ rules })}
      />
    </div>
  );
}

function PricingStep({ draft, edit }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 @lg/wizard:grid-cols-2">
        <Field label="Nightly price (USD)" htmlFor="nightly-price">
          <TextInput
            id="nightly-price"
            inputMode="decimal"
            value={draft.nightlyPrice}
            placeholder="180"
            onChange={(event) => edit({ nightlyPrice: event.target.value })}
          />
        </Field>
        <Field label="Cleaning fee (USD)" htmlFor="cleaning-fee">
          <TextInput
            id="cleaning-fee"
            inputMode="decimal"
            value={draft.cleaningFee}
            placeholder="0"
            onChange={(event) => edit({ cleaningFee: event.target.value })}
          />
        </Field>
      </div>
      <p className="text-sm text-checkin-muted">
        Guests also pay a sample 10% service fee. You receive the nightly price
        plus the cleaning fee — all payouts are simulated.
      </p>

      <fieldset>
        <legend className="font-semibold">Booking mode</legend>
        <div className="mt-3 grid gap-3 @lg/wizard:grid-cols-2">
          {(
            [
              ["instant", "Guests book right away and pay within 15 minutes."],
              [
                "request",
                "You approve each request within 24 hours before the guest pays.",
              ],
            ] as const
          ).map(([mode, description]) => (
            <label
              key={mode}
              className="flex cursor-pointer gap-3 rounded-[0.9rem] border border-checkin-line p-4 has-checked:border-checkin-ink has-checked:bg-checkin-mist/40"
            >
              <input
                type="radio"
                name="booking-mode"
                className="mt-1 size-4 accent-checkin-ink"
                checked={draft.bookingMode === mode}
                onChange={() => edit({ bookingMode: mode })}
              />
              <span>
                <span className="block font-semibold">
                  {bookingModeLabels[mode]}
                </span>
                <span className="text-sm text-checkin-muted">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 @lg/wizard:grid-cols-2">
        <Field label="Check-in from" htmlFor="check-in">
          <TextInput
            id="check-in"
            type="time"
            value={draft.checkInTime}
            onChange={(event) => edit({ checkInTime: event.target.value })}
          />
        </Field>
        <Field label="Check-out by" htmlFor="check-out">
          <TextInput
            id="check-out"
            type="time"
            value={draft.checkOutTime}
            onChange={(event) => edit({ checkOutTime: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function ReviewStep({
  listing,
  photoCount,
  onFix,
}: {
  listing: Listing;
  photoCount: number;
  onFix: (step: WizardStepId) => void;
}) {
  const router = useRouter();
  const setStatus = useMutation(api.listings.setStatus);
  const allowance = useHostAllowance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = listingReadinessIssues({ ...listing, photoCount });
  const blockedByPlan =
    listing.status === "draft" &&
    allowance.loaded &&
    !allowance.canPublishAnother;

  async function changeStatus(status: Listing["status"]) {
    setBusy(true);
    setError(null);
    try {
      await setStatus({ listingId: listing._id, status });
      if (status === "published") router.push("/hosting?published=1");
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          status === "published"
            ? "This listing couldn't be published. Check the details and your plan allowance."
            : "Couldn't update the listing.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const facts = [
    ["Type", propertyTypeLabels[listing.propertyType]],
    ["Category", listing.category || "—"],
    [
      "Location",
      [listing.publicLocation.city, listing.publicLocation.countryCode]
        .filter(Boolean)
        .join(", ") || "—",
    ],
    [
      "Capacity",
      `${listing.maxGuests} guests · ${listing.bedrooms} bedrooms · ${listing.beds} beds · ${listing.bathrooms} baths`,
    ],
    ["Photos", String(photoCount)],
    [
      "Price",
      `${formatNightlyPrice(listing.nightlyPriceCents)} night · ${formatNightlyPrice(listing.cleaningFeeCents)} cleaning`,
    ],
    ["Booking", bookingModeLabels[listing.bookingMode]],
    [
      "Times",
      `Check-in ${listing.checkInTime} · check-out ${listing.checkOutTime}`,
    ],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-x-6 gap-y-3 text-sm @lg/wizard:grid-cols-2">
        {facts.map(([term, detail]) => (
          <div key={term} className="flex flex-col">
            <dt className="text-checkin-muted">{term}</dt>
            <dd className="font-medium">{detail}</dd>
          </div>
        ))}
      </dl>

      {issues.length ? (
        <section
          aria-labelledby="issues-heading"
          className="rounded-[0.9rem] border border-checkin-signal/40 bg-checkin-signal/5 p-4"
        >
          <h2 id="issues-heading" className="font-semibold">
            Finish these before publishing
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {issues.map((issue) => (
              <li key={issue.message}>
                <button
                  type="button"
                  onClick={() => onFix(issue.step)}
                  className="text-left text-sm underline decoration-checkin-signal/50 underline-offset-4 hover:decoration-checkin-signal"
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {blockedByPlan ? (
        <p className="rounded-[0.9rem] border border-checkin-line bg-checkin-mist/40 p-4 text-sm">
          You&apos;re using {allowance.publishedCount} of {allowance.allowance}{" "}
          published {allowance.allowance === 1 ? "listing" : "listings"} on your
          plan.{" "}
          {allowance.isPro ? (
            "Unpublish another listing to publish this one."
          ) : (
            <Link
              href="/hosting/plans"
              className="font-semibold underline underline-offset-4"
            >
              Upgrade to Host Pro to publish up to ten.
            </Link>
          )}
        </p>
      ) : null}

      {listing.bookingSuspended ? (
        <p className="rounded-[0.9rem] border border-checkin-line bg-checkin-mist/40 p-4 text-sm">
          This listing is published but suspended from new bookings because it
          is over your plan&apos;s allowance. Existing reservations are
          unaffected.{" "}
          <Link
            href="/hosting/plans"
            className="font-semibold underline underline-offset-4"
          >
            Manage your plan
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-checkin-signal">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {listing.status === "draft" ? (
          <Button
            type="button"
            variant="signal"
            disabled={busy || issues.length > 0 || blockedByPlan}
            onClick={() => void changeStatus("published")}
          >
            Publish listing
          </Button>
        ) : null}
        {listing.status === "published" ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void changeStatus("draft")}
          >
            Unpublish
          </Button>
        ) : null}
      </div>
    </div>
  );
}
