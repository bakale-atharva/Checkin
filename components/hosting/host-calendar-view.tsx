"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import {
  addDays,
  buildCalendarDays,
  dateRange,
  formatCalendarDay,
  localToday,
  type CalendarDay,
  type CalendarEntry,
} from "@/lib/hosting/host-calendar";
import {
  centsToDollarInput,
  parseDollarsToCents,
} from "@/lib/hosting/listing-readiness";
import { cn } from "@/lib/utils";
import { errorMessage, Field, TextInput } from "./form-controls";

const WINDOW_DAYS = 14;

type Selection = { listingId: Id<"listings">; date: string };

const reservationLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Booked",
  completed: "Completed",
};

export function HostCalendarView() {
  const { isAuthenticated } = useConvexAuth();
  const listings = useQuery(
    api.listings.myListings,
    isAuthenticated ? {} : "skip",
  );
  const [today] = useState(() => localToday());
  const [start, setStart] = useState(today);
  const [selection, setSelection] = useState<Selection | null>(null);
  const dates = dateRange(start, WINDOW_DAYS);
  const active = (listings ?? []).filter(
    (listing) => listing.status !== "archived",
  );
  const selectedListing = active.find(
    (listing) => listing._id === selection?.listingId,
  );

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em]">
            Calendar
          </h1>
          <p className="mt-1 text-checkin-muted">
            Every property, side by side. Select a night to block it or set a
            special price.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous two weeks"
            disabled={start <= today}
            onClick={() => setStart(addDays(start, -WINDOW_DAYS))}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={start === today}
            onClick={() => setStart(today)}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next two weeks"
            onClick={() => setStart(addDays(start, WINDOW_DAYS))}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-checkin-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-checkin-ink" />
          Booked
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-sm border border-checkin-ink bg-checkin-mist"
          />
          Pending payment
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-sm bg-[repeating-linear-gradient(135deg,var(--checkin-line)_0_3px,transparent_3px_6px)]"
          />
          Blocked
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-sm bg-checkin-signal/20"
          />
          Special price
        </li>
      </ul>

      {listings === undefined ? (
        <p className="mt-10 text-checkin-muted">Loading calendar…</p>
      ) : active.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-checkin-line px-6 py-16 text-center">
          <CalendarDays aria-hidden className="size-7 text-checkin-muted" />
          <p className="font-semibold">No properties to schedule yet</p>
          <Link
            href="/hosting"
            className="text-sm font-semibold underline underline-offset-4"
          >
            Create a listing
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[1.1rem] border border-checkin-line bg-checkin-paper">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <caption className="sr-only">
              Availability for the two weeks from {formatCalendarDay(start)}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-56 border-b border-checkin-line bg-checkin-paper px-4 py-3 text-left font-semibold"
                >
                  Property
                </th>
                {dates.map((date) => {
                  const [weekday, ...rest] = formatCalendarDay(date).split(" ");
                  return (
                    <th
                      key={date}
                      scope="col"
                      className={cn(
                        "border-b border-checkin-line px-1 py-2 text-center text-xs font-medium text-checkin-muted",
                        date === today && "text-checkin-ink",
                      )}
                    >
                      <span className="block">{weekday?.replace(",", "")}</span>
                      <span className="block font-semibold">
                        {rest.join(" ")}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {active.map((listing) => (
                <CalendarRow
                  key={listing._id}
                  listing={listing}
                  dates={dates}
                  selection={selection}
                  onSelect={setSelection}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selection && selectedListing ? (
        <DayEditor
          key={`${selection.listingId}-${selection.date}`}
          listing={selectedListing}
          date={selection.date}
          onClose={() => setSelection(null)}
        />
      ) : null}
    </main>
  );
}

function useListingDays(listingId: Id<"listings">, dates: string[]) {
  const { isAuthenticated } = useConvexAuth();
  const entries = useQuery(
    api.dashboard.hostCalendar,
    isAuthenticated
      ? {
          listingId,
          startDate: dates[0]!,
          endDate: addDays(dates[dates.length - 1]!, 1),
        }
      : "skip",
  ) as CalendarEntry[] | undefined;
  return entries === undefined ? undefined : buildCalendarDays(dates, entries);
}

function CalendarRow({
  listing,
  dates,
  selection,
  onSelect,
}: {
  listing: Doc<"listings">;
  dates: string[];
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const days = useListingDays(listing._id, dates);

  return (
    <tr className="border-b border-checkin-line last:border-b-0">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-checkin-paper px-4 py-2 text-left font-medium"
      >
        <span className="block max-w-48 truncate">{listing.title}</span>
        <span className="text-xs font-normal text-checkin-muted capitalize">
          {listing.bookingSuspended ? "Suspended" : listing.status} ·{" "}
          {formatNightlyPrice(listing.nightlyPriceCents)}
        </span>
      </th>
      {(
        days ?? dates.map((date) => ({ date, blocked: false }) as CalendarDay)
      ).map((day) => {
        const selected =
          selection?.listingId === listing._id && selection.date === day.date;
        const state = day.reservation
          ? (reservationLabels[day.reservation.status] ?? "Reserved")
          : day.blocked
            ? "Blocked"
            : "Open";
        const price = formatNightlyPrice(
          day.priceOverrideCents ?? listing.nightlyPriceCents,
        );
        return (
          <td key={day.date} className="p-0.5">
            <button
              type="button"
              disabled={days === undefined}
              aria-pressed={selected}
              aria-label={`${listing.title}, ${formatCalendarDay(day.date)}: ${state}, ${price}${day.priceOverrideCents ? " special price" : ""}`}
              onClick={() =>
                onSelect({ listingId: listing._id, date: day.date })
              }
              className={cn(
                "flex h-14 w-full min-w-11 flex-col items-center justify-center rounded-[0.5rem] text-[0.7rem] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/45",
                day.reservation?.status === "confirmed" ||
                  day.reservation?.status === "completed"
                  ? "bg-checkin-ink text-checkin-canvas"
                  : day.reservation
                    ? "border border-checkin-ink bg-checkin-mist"
                    : day.blocked
                      ? "bg-[repeating-linear-gradient(135deg,var(--checkin-line)_0_3px,transparent_3px_6px)] text-checkin-muted"
                      : day.priceOverrideCents
                        ? "bg-checkin-signal/15 hover:bg-checkin-signal/25"
                        : "hover:bg-checkin-mist/60",
                selected && "ring-2 ring-checkin-signal ring-offset-1",
              )}
            >
              <span className="font-semibold">
                {day.reservation ? state : day.blocked ? "—" : price}
              </span>
            </button>
          </td>
        );
      })}
    </tr>
  );
}

function DayEditor({
  listing,
  date,
  onClose,
}: {
  listing: Doc<"listings">;
  date: string;
  onClose: () => void;
}) {
  const days = useListingDays(listing._id, [date]);
  const day = days?.[0];
  const setBlockedDate = useMutation(api.listings.setBlockedDate);
  const setOverride = useMutation(api.listings.setNightlyPriceOverride);
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const priceValue =
    price ??
    (day?.priceOverrideCents ? centsToDollarInput(day.priceOverrideCents) : "");

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
    } finally {
      setBusy(false);
    }
  }

  function savePrice() {
    const cents = parseDollarsToCents(priceValue);
    if (cents === null || cents < 1) {
      setError("Enter a nightly price of at least $1.");
      return;
    }
    void run(
      () =>
        setOverride({ listingId: listing._id, date, nightlyPriceCents: cents }),
      "Couldn't save the special price.",
    );
  }

  return (
    <Surface
      role="region"
      aria-label={`Edit ${formatCalendarDay(date)} for ${listing.title}`}
      className="mt-6 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-checkin-muted">{listing.title}</p>
          <h2 className="text-lg font-semibold">{formatCalendarDay(date)}</h2>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {day === undefined ? (
        <p className="mt-4 text-sm text-checkin-muted">Loading…</p>
      ) : day.reservation ? (
        <p className="mt-4 text-sm">
          This night is held by a{" "}
          {day.reservation.status === "pending"
            ? "reservation awaiting simulated payment"
            : "confirmed reservation"}
          . Reserved nights can&apos;t be blocked or repriced.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Availability</p>
            <p className="text-sm text-checkin-muted">
              {day.blocked
                ? "Blocked — guests can't book this night."
                : "Open for bookings."}
            </p>
            <Button
              type="button"
              variant={day.blocked ? "primary" : "outline"}
              className="self-start"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    setBlockedDate({
                      listingId: listing._id,
                      date,
                      blocked: !day.blocked,
                    }),
                  "Couldn't update availability.",
                )
              }
            >
              {day.blocked ? "Unblock night" : "Block night"}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Field
              label="Special nightly price (USD)"
              htmlFor="override-price"
              hint={`Default is ${formatNightlyPrice(listing.nightlyPriceCents)}.`}
            >
              <TextInput
                id="override-price"
                inputMode="decimal"
                value={priceValue}
                placeholder={centsToDollarInput(listing.nightlyPriceCents)}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !priceValue.trim()}
                onClick={savePrice}
              >
                Save price
              </Button>
              {day.priceOverrideCents ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setPrice("");
                    void run(
                      () =>
                        setOverride({
                          listingId: listing._id,
                          date,
                          nightlyPriceCents: null,
                        }),
                      "Couldn't clear the special price.",
                    );
                  }}
                >
                  Use default
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {error ? (
        <p
          role="alert"
          className="mt-4 text-sm font-medium text-checkin-signal"
        >
          {error}
        </p>
      ) : null}
    </Surface>
  );
}
