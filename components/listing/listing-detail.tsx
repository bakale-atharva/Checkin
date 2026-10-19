"use client";

import { useQuery } from "convex/react";
import {
  Bath,
  BedDouble,
  Check,
  Clock,
  DoorOpen,
  ScrollText,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { WishlistButton } from "@/components/discovery/wishlist-button";
import { SimulationBadge, Stepper } from "@/components/hosting/form-controls";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  addDays,
  estimateStay,
  parseStayParams,
  stayHasUnavailableNight,
  todayIn,
  type StaySelection,
} from "@/lib/booking/stay-selection";
import { propertyTypeLabels } from "@/lib/discovery/catalog";
import { ApproximateMap } from "./approximate-map";
import { AvailabilityCalendar } from "./availability-calendar";
import { BookingWidget, MobileBookingBar } from "./booking-widget";
import { ListingReviews } from "./listing-reviews";
import { PhotoGallery } from "./photo-gallery";

const BOOKING_WINDOW_DAYS = 365;

function formatClock(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function ListingDetail() {
  const { listingId: rawId } = useParams<{ listingId: string }>();
  const listingId = rawId as Id<"listings">;
  const router = useRouter();
  const searchParams = useSearchParams();
  const listing = useQuery(api.listings.getPublished, { listingId });
  const saved = useQuery(api.dashboard.savedListingIds, {
    listingIds: [listingId],
  });
  const [now] = useState(() => Date.now());
  const today = listing ? todayIn(listing.timezone, now) : null;
  const availability = useQuery(
    api.listings.publicAvailability,
    listing && today
      ? {
          listingId,
          startDate: today,
          endDate: addDays(today, BOOKING_WINDOW_DAYS + 1),
        }
      : "skip",
  );

  const stay = parseStayParams(searchParams);
  const selection: StaySelection = {
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
  };
  const guests = listing ? Math.min(stay.guests, listing.maxGuests) : 1;

  const unavailable = useMemo(
    () => new Set(availability?.unavailableDates ?? []),
    [availability],
  );
  const overrides = useMemo(
    () =>
      Object.fromEntries(
        (availability?.priceOverrides ?? []).map((override) => [
          override.date,
          override.nightlyPriceCents,
        ]),
      ),
    [availability],
  );

  function updateUrl(next: StaySelection, nextGuests = guests) {
    const params = new URLSearchParams();
    if (next.checkIn) params.set("checkIn", next.checkIn);
    if (next.checkOut) params.set("checkOut", next.checkOut);
    if (nextGuests > 1) params.set("guests", String(nextGuests));
    const query = params.toString();
    router.replace(`/listings/${listingId}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }

  if (listing === undefined) {
    return (
      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-8 w-2/3 animate-pulse rounded bg-checkin-mist motion-reduce:animate-none" />
        <div className="mt-6 aspect-[2/1] animate-pulse rounded-[1.25rem] bg-checkin-mist motion-reduce:animate-none" />
        <p className="sr-only" role="status">
          Loading stay…
        </p>
      </main>
    );
  }

  if (listing === null) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <DoorOpen aria-hidden className="size-8 text-checkin-muted" />
        <h1 className="text-2xl font-semibold">
          This stay isn&apos;t available
        </h1>
        <p className="text-checkin-muted">
          The host may have unpublished it, or it was removed. Your existing
          reservations aren&apos;t affected.
        </p>
        <Link
          href="/"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Browse other stays
        </Link>
      </main>
    );
  }

  const place = [listing.publicLocation.city, listing.publicLocation.region]
    .filter(Boolean)
    .join(", ");
  const conflict =
    !!availability &&
    !!selection.checkIn &&
    !!selection.checkOut &&
    stayHasUnavailableNight(selection.checkIn, selection.checkOut, unavailable);
  const estimate =
    selection.checkIn && selection.checkOut
      ? estimateStay({
          checkIn: selection.checkIn,
          checkOut: selection.checkOut,
          timezone: listing.timezone,
          checkInTime: listing.checkInTime,
          checkOutTime: listing.checkOutTime,
          nightlyPriceCents: listing.nightlyPriceCents,
          cleaningFeeCents: listing.cleaningFeeCents,
          nightlyPriceOverrides: overrides,
        })
      : null;
  const checkoutHref =
    selection.checkIn && selection.checkOut && estimate
      ? `/listings/${listingId}/checkout?${new URLSearchParams({
          checkIn: selection.checkIn,
          checkOut: selection.checkOut,
          guests: String(guests),
        })}`
      : null;
  const widgetProps = {
    nightlyPriceCents: listing.nightlyPriceCents,
    maxGuests: listing.maxGuests,
    bookingMode: listing.bookingMode,
    selection,
    guests,
    estimate,
    conflict,
    checkoutHref,
    onGuestsChange: (value: number) => updateUrl(selection, value),
    onClearDates: () => updateUrl({}),
  };
  const rating = listing.reviewSummary?.overall ?? listing.publishedRating;

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 pt-8 pb-28 sm:px-6 lg:px-8 lg:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-balance">
            {listing.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            {rating ? (
              <a
                href="#reviews-heading"
                className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
              >
                <Star aria-hidden className="size-3.5 fill-checkin-ink" />
                <span className="sr-only">Rated</span>
                {rating.toFixed(2)}
                {listing.reviewSummary
                  ? ` · ${listing.reviewSummary.count} reviews`
                  : ""}
              </a>
            ) : (
              <span className="font-semibold">New</span>
            )}
            <span aria-hidden>·</span>
            <span className="text-checkin-muted">{place}</span>
          </p>
        </div>
        <WishlistButton
          listingId={listingId}
          listingTitle={listing.title}
          saved={(saved ?? []).includes(listingId)}
          className="rounded-full border border-checkin-line"
        />
      </div>

      <div className="mt-6">
        <PhotoGallery photos={listing.photos} title={listing.title} />
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 divide-y divide-checkin-line">
          <section className="pb-8">
            <h2 className="text-xl font-semibold">
              {propertyTypeLabels[listing.propertyType]} in {place}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-checkin-muted">
              <li className="inline-flex items-center gap-1.5">
                <Users aria-hidden className="size-4" />
                Up to {listing.maxGuests}{" "}
                {listing.maxGuests === 1 ? "guest" : "guests"}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <DoorOpen aria-hidden className="size-4" />
                {listing.bedrooms}{" "}
                {listing.bedrooms === 1 ? "bedroom" : "bedrooms"}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BedDouble aria-hidden className="size-4" />
                {listing.beds} {listing.beds === 1 ? "bed" : "beds"}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Bath aria-hidden className="size-4" />
                {listing.bathrooms} {listing.bathrooms === 1 ? "bath" : "baths"}
              </li>
            </ul>
          </section>

          <section
            aria-labelledby="host-heading"
            className="flex items-center gap-4 py-8"
          >
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-checkin-ink text-lg font-semibold text-checkin-canvas"
            >
              {(listing.host.firstName ?? "H").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 id="host-heading" className="font-semibold">
                Hosted by {listing.host.firstName ?? "a Checkin host"}
              </h2>
              <p className="text-sm text-checkin-muted">
                Hosting on Checkin since{" "}
                {new Date(listing.host.joinedAt).getFullYear()} · You can
                message your host once you&apos;ve booked.
              </p>
            </div>
          </section>

          <section aria-labelledby="about-heading" className="py-8">
            <h2 id="about-heading" className="sr-only">
              About this stay
            </h2>
            <p className="leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </section>

          <section aria-labelledby="amenities-heading" className="py-8">
            <h2 id="amenities-heading" className="text-xl font-semibold">
              What this place offers
            </h2>
            {listing.amenities.length > 0 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {listing.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center gap-3">
                    <Check aria-hidden className="size-4 text-checkin-signal" />
                    {amenity}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-checkin-muted">
                The host hasn&apos;t listed any amenities.
              </p>
            )}
          </section>

          <section aria-labelledby="availability" className="scroll-mt-24 py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="availability"
                tabIndex={-1}
                className="scroll-mt-24 text-xl font-semibold focus:outline-none"
              >
                Availability
              </h2>
              <SimulationBadge>Test mode</SimulationBadge>
            </div>
            <p className="mt-1 text-sm text-checkin-muted">
              Stays of 1–28 nights. Dates are local to {place}.
            </p>
            <div className="mt-4">
              {availability === undefined || !today ? (
                <p role="status" className="text-sm text-checkin-muted">
                  Loading availability…
                </p>
              ) : (
                <AvailabilityCalendar
                  today={today}
                  lastDate={addDays(today, BOOKING_WINDOW_DAYS)}
                  selection={selection}
                  unavailable={unavailable}
                  onChange={(next) => updateUrl(next)}
                />
              )}
            </div>
            <div className="mt-4 border-t border-checkin-line lg:hidden">
              <Stepper
                id="mobile-guests"
                label="Guests"
                value={guests}
                min={1}
                max={listing.maxGuests}
                onChange={(value) => updateUrl(selection, value)}
              />
            </div>
          </section>

          <section aria-labelledby="rules-heading" className="py-8">
            <h2 id="rules-heading" className="text-xl font-semibold">
              Things to know
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Clock aria-hidden className="size-4" /> Arrival and departure
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-checkin-muted">
                  <li>Check-in after {formatClock(listing.checkInTime)}</li>
                  <li>Checkout before {formatClock(listing.checkOutTime)}</li>
                  <li>
                    Free cancellation until 24 hours before check-in (full
                    simulated refund)
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <ScrollText aria-hidden className="size-4" /> House rules
                </h3>
                {listing.rules.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-checkin-muted">
                    {listing.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-checkin-muted">
                    No additional rules.
                  </p>
                )}
              </div>
            </div>
          </section>

          <ListingReviews
            listingId={listingId}
            summary={listing.reviewSummary}
          />

          <section aria-labelledby="location-heading" className="py-10">
            <h2 id="location-heading" className="text-xl font-semibold">
              Where you&apos;ll be
            </h2>
            <p className="mt-1 mb-4 text-sm text-checkin-muted">
              {place}. The map shows the general area; the exact address is
              shared after your booking is confirmed.
            </p>
            <ApproximateMap
              latitude={listing.publicLocation.latitude}
              longitude={listing.publicLocation.longitude}
              place={place}
            />
          </section>
        </div>

        <aside aria-label="Book this stay" className="max-lg:hidden">
          <div className="sticky top-24">
            <BookingWidget {...widgetProps} />
          </div>
        </aside>
      </div>
      <MobileBookingBar {...widgetProps} />
    </main>
  );
}
