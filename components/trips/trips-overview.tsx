"use client";

import { usePaginatedQuery } from "convex/react";
import { Luggage } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";

import { ListingPhoto } from "@/components/discovery/listing-photo";
import { formatStayDate } from "@/components/listing/price-breakdown";
import { Button } from "@/components/ui/button";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import {
  tripGroup,
  type TripGroup,
} from "@/lib/reservations/cancellation-preview";
import { cn } from "@/lib/utils";
import { TripStatusBadge } from "./trip-status-badge";

type Trip = {
  reservation: Doc<"reservations">;
  listing: {
    id: Id<"listings">;
    title: string;
    city: string;
    region?: string;
    coverPhotoUrl: string | null;
  } | null;
};

const tabs: { id: TripGroup; label: string; empty: string }[] = [
  {
    id: "upcoming",
    label: "Upcoming",
    empty: "No upcoming trips. Time to plan your next stay.",
  },
  { id: "past", label: "Past", empty: "Trips you've taken show up here." },
  {
    id: "cancelled",
    label: "Cancelled",
    empty: "Cancelled, declined, and expired bookings show up here.",
  },
];

export function TripsOverview() {
  const profileReady = useProfileReady();
  const { results, status, loadMore } = usePaginatedQuery(
    api.dashboard.guestTrips,
    profileReady ? {} : "skip",
    { initialNumItems: 24 },
  );
  const [active, setActive] = useState<TripGroup>("upcoming");
  const [now] = useState(() => Date.now());
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trips = results as Trip[];
  const grouped = Object.fromEntries(
    tabs.map((tab) => [
      tab.id,
      trips.filter((trip) => tripGroup(trip.reservation, now) === tab.id),
    ]),
  ) as Record<TripGroup, Trip[]>;
  // Upcoming trips read soonest first; history reads newest first.
  grouped.upcoming.sort((a, b) =>
    a.reservation.checkIn.localeCompare(b.reservation.checkIn),
  );
  grouped.past.sort((a, b) =>
    b.reservation.checkIn.localeCompare(a.reservation.checkIn),
  );
  const shown = grouped[active];
  const activeTab = tabs.find((tab) => tab.id === active)!;

  function onTabKeyDown(event: KeyboardEvent, index: number) {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-[-0.05em]">Trips</h1>
      <p className="mt-1 text-checkin-muted">
        Your reservations and requests. All payments are simulated.
      </p>

      <div
        role="tablist"
        aria-label="Trip groups"
        className="mt-6 flex gap-1 border-b border-checkin-line"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`trips-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls="trips-panel"
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-semibold text-checkin-muted hover:text-checkin-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35",
              active === tab.id && "border-checkin-ink text-checkin-ink",
            )}
          >
            {tab.label}
            {status !== "LoadingFirstPage" ? (
              <span className="rounded-full bg-checkin-mist px-1.5 text-xs tabular-nums">
                {grouped[tab.id].length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        id="trips-panel"
        role="tabpanel"
        aria-labelledby={`trips-tab-${active}`}
        className="mt-8"
      >
        {status === "LoadingFirstPage" ? (
          <p role="status" className="text-checkin-muted">
            Loading trips…
          </p>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-checkin-line px-6 py-16 text-center">
            <Luggage aria-hidden className="size-7 text-checkin-muted" />
            <p className="max-w-sm text-sm text-checkin-muted">
              {activeTab.empty}
            </p>
            {active === "upcoming" ? (
              <Link
                href="/"
                className="text-sm font-semibold underline underline-offset-4"
              >
                Browse stays
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((trip) => (
              <TripCard key={trip.reservation._id} trip={trip} />
            ))}
          </ul>
        )}
        {status === "CanLoadMore" ? (
          <Button
            type="button"
            variant="outline"
            className="mt-8"
            onClick={() => loadMore(24)}
          >
            Load older trips
          </Button>
        ) : null}
      </div>
    </main>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { reservation, listing } = trip;
  const place = listing
    ? [listing.city, listing.region].filter(Boolean).join(", ")
    : "Removed listing";
  return (
    <li className="group relative">
      <div className="relative aspect-[3/2] overflow-hidden rounded-[1.1rem] bg-checkin-mist">
        <ListingPhoto
          src={listing?.coverPhotoUrl}
          alt={listing?.title ?? "Listing"}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
        <TripStatusBadge
          reservation={reservation}
          className="absolute top-3 left-3 shadow-sm"
        />
      </div>
      <h2 className="mt-3 truncate font-semibold">
        <Link
          href={`/trips/${reservation._id}`}
          className="after:absolute after:inset-0 after:rounded-[1.1rem] focus-visible:underline focus-visible:outline-none"
        >
          {place}
        </Link>
      </h2>
      <p className="truncate text-sm text-checkin-muted">{listing?.title}</p>
      <p className="text-sm text-checkin-muted">
        {formatStayDate(reservation.checkIn)} –{" "}
        {formatStayDate(reservation.checkOut)} · {reservation.guests}{" "}
        {reservation.guests === 1 ? "guest" : "guests"}
      </p>
      <p className="pt-1 text-sm">
        <span className="font-semibold">
          {formatNightlyPrice(reservation.quote.totalCents)}
        </span>{" "}
        <span className="text-checkin-muted">total, simulated</span>
      </p>
    </li>
  );
}
