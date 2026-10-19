"use client";

import { AlertTriangle, Zap } from "lucide-react";
import Link from "next/link";

import { Stepper } from "@/components/hosting/form-controls";
import { Surface } from "@/components/ui/surface";
import type { StaySelection } from "@/lib/booking/stay-selection";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import type { ReservationQuote } from "@/lib/reservations/reservation-policy";
import { cn } from "@/lib/utils";
import { formatStayDate, PriceBreakdown } from "./price-breakdown";

const primaryLink =
  "inline-flex h-13 w-full items-center justify-center rounded-[0.8rem] bg-checkin-signal px-5 text-base font-semibold text-white transition-colors hover:bg-checkin-signal/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35";

export type BookingWidgetProps = {
  nightlyPriceCents: number;
  maxGuests: number;
  bookingMode: "instant" | "request";
  selection: StaySelection;
  guests: number;
  estimate: ReservationQuote | null;
  conflict: boolean;
  checkoutHref: string | null;
  onGuestsChange: (guests: number) => void;
  onClearDates: () => void;
};

/** Desktop sidebar booking card: dates, guests, an estimated price, and Reserve. */
export function BookingWidget(props: BookingWidgetProps) {
  const {
    nightlyPriceCents,
    maxGuests,
    bookingMode,
    selection,
    guests,
    estimate,
    conflict,
    checkoutHref,
    onGuestsChange,
    onClearDates,
  } = props;
  return (
    <Surface className="p-6">
      <p className="text-xl">
        <span className="font-semibold">
          {formatNightlyPrice(nightlyPriceCents)}
        </span>{" "}
        <span className="text-base text-checkin-muted">night</span>
      </p>

      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[0.8rem] border border-checkin-line text-sm">
        <a
          href="#availability"
          className="border-r border-checkin-line px-3 py-2.5 hover:bg-checkin-mist/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-checkin-signal/35"
        >
          <span className="block text-[0.7rem] font-bold uppercase tracking-wide">
            Check-in
          </span>
          {selection.checkIn ? formatStayDate(selection.checkIn) : "Add date"}
        </a>
        <a
          href="#availability"
          className="px-3 py-2.5 hover:bg-checkin-mist/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-checkin-signal/35"
        >
          <span className="block text-[0.7rem] font-bold uppercase tracking-wide">
            Checkout
          </span>
          {selection.checkOut ? formatStayDate(selection.checkOut) : "Add date"}
        </a>
      </div>
      <div className="border-b border-checkin-line">
        <Stepper
          id="widget-guests"
          label="Guests"
          value={Math.min(guests, maxGuests)}
          min={1}
          max={maxGuests}
          onChange={onGuestsChange}
        />
      </div>

      <WidgetStatus {...props} />

      {checkoutHref && !conflict ? (
        <Link href={checkoutHref} className={cn(primaryLink, "mt-5")}>
          {bookingMode === "instant" ? "Reserve" : "Request to book"}
        </Link>
      ) : (
        <a href="#availability" className={cn(primaryLink, "mt-5")}>
          Check availability
        </a>
      )}
      <p className="mt-2 text-center text-xs text-checkin-muted">
        {bookingMode === "instant" ? (
          <span className="inline-flex items-center gap-1">
            <Zap aria-hidden className="size-3" /> Instant book · you won&apos;t
            be charged yet
          </span>
        ) : (
          "The host has 24 hours to respond. No payment until they accept."
        )}
      </p>

      {estimate && !conflict ? (
        <PriceBreakdown quote={estimate} estimate className="mt-5" />
      ) : null}
      {selection.checkIn || selection.checkOut ? (
        <button
          type="button"
          onClick={onClearDates}
          className="mt-4 text-sm font-semibold underline underline-offset-4"
        >
          Clear dates
        </button>
      ) : null}
    </Surface>
  );
}

function WidgetStatus({ conflict, selection }: BookingWidgetProps) {
  if (conflict)
    return (
      <p
        role="alert"
        className="mt-4 flex gap-2 rounded-[0.8rem] bg-checkin-signal/10 px-3 py-2.5 text-sm"
      >
        <AlertTriangle
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-checkin-signal"
        />
        Some of those nights were just booked or blocked. Pick new dates in the
        calendar.
      </p>
    );
  if (selection.checkIn && !selection.checkOut)
    return (
      <p className="mt-4 text-sm text-checkin-muted">
        Now choose a checkout date.
      </p>
    );
  return null;
}

/** Fixed bottom bar for small screens, mirroring the widget's main action. */
export function MobileBookingBar({
  nightlyPriceCents,
  selection,
  estimate,
  conflict,
  checkoutHref,
  bookingMode,
}: BookingWidgetProps) {
  const ready = checkoutHref && !conflict;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-checkin-line bg-checkin-paper/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
        <div className="min-w-0 text-sm">
          <p>
            <span className="font-semibold">
              {ready && estimate
                ? formatNightlyPrice(estimate.totalCents)
                : formatNightlyPrice(nightlyPriceCents)}
            </span>{" "}
            <span className="text-checkin-muted">
              {ready && estimate ? "total, simulated" : "night"}
            </span>
          </p>
          <p className="truncate text-checkin-muted">
            {selection.checkIn && selection.checkOut
              ? `${formatStayDate(selection.checkIn)} – ${formatStayDate(selection.checkOut)}`
              : "Add dates for prices"}
          </p>
        </div>
        {ready ? (
          <Link
            href={checkoutHref}
            className="inline-flex h-11 shrink-0 items-center rounded-[0.8rem] bg-checkin-signal px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
          >
            {bookingMode === "instant" ? "Reserve" : "Request"}
          </Link>
        ) : (
          <a
            href="#availability"
            className="inline-flex h-11 shrink-0 items-center rounded-[0.8rem] bg-checkin-ink px-5 text-sm font-semibold text-checkin-canvas focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
          >
            {conflict ? "Change dates" : "Choose dates"}
          </a>
        )}
      </div>
    </div>
  );
}
