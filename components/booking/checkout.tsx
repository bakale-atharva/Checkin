"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowLeft, CalendarX, Clock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { ListingPhoto } from "@/components/discovery/listing-photo";
import {
  errorMessage,
  SimulationBadge,
} from "@/components/hosting/form-controls";
import {
  formatLocalDateTime,
  formatStayDate,
  PriceBreakdown,
} from "@/components/listing/price-breakdown";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { parseStayParams } from "@/lib/booking/stay-selection";
import { ReservationProgress } from "./reservation-progress";
import { formatCountdown, useNow } from "./use-now";

type Quote = {
  quoteId: Id<"reservationQuotes">;
  expiresAt: number;
  idempotencyKey: string;
  quote: {
    nightlyCharges: { date: string; amountCents: number }[];
    accommodationCents: number;
    cleaningFeeCents: number;
    serviceFeeCents: number;
    taxCents: number;
    totalCents: number;
    hostProceedsCents: number;
    checkInAt: string;
    checkOutAt: string;
    cancellationDeadline: string;
  };
};

type QuoteState =
  | { kind: "loading" }
  | { kind: "ready"; value: Quote }
  | { kind: "failed"; code: string; message: string };

type TripDetail = {
  reservation: Doc<"reservations">;
  chargeProcessing: boolean;
};

function codeOf(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "object")
    return String((error.data as { code?: unknown }).code ?? "");
  return "";
}

export function Checkout() {
  const { listingId: rawId } = useParams<{ listingId: string }>();
  const listingId = rawId as Id<"listings">;
  const router = useRouter();
  const searchParams = useSearchParams();
  const stay = parseStayParams(searchParams);
  const { checkIn, checkOut, guests } = stay;
  const reservationParam = searchParams.get(
    "reservation",
  ) as Id<"reservations"> | null;
  const profileReady = useProfileReady();
  const listing = useQuery(api.listings.getPublished, { listingId });
  const trip = useQuery(
    api.dashboard.tripDetail,
    profileReady && reservationParam
      ? { reservationId: reservationParam }
      : "skip",
  ) as TripDetail | undefined;
  const requestQuote = useMutation(api.reservations.quote);
  const createReservation = useMutation(api.reservations.createFromQuote);
  const capture = useMutation(api.reservations.capturePayment);
  const now = useNow();
  const [quoteState, setQuoteState] = useState<QuoteState>({
    kind: "loading",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requested = useRef(false);

  const listingHref = (withDates: boolean) => {
    const params = new URLSearchParams();
    if (withDates && stay.checkIn && stay.checkOut) {
      params.set("checkIn", stay.checkIn);
      params.set("checkOut", stay.checkOut);
    }
    if (stay.guests > 1) params.set("guests", String(stay.guests));
    const query = params.toString();
    return `/listings/${listingId}${query ? `?${query}` : ""}#availability`;
  };

  async function fetchQuote() {
    if (!checkIn || !checkOut) return;
    setQuoteState({ kind: "loading" });
    try {
      const result = await requestQuote({
        listingId,
        checkIn,
        checkOut,
        guests,
      });
      setQuoteState({
        kind: "ready",
        value: { ...result, idempotencyKey: crypto.randomUUID() },
      });
    } catch (caught) {
      setQuoteState({
        kind: "failed",
        code: codeOf(caught),
        message: errorMessage(caught, "We couldn't price this stay."),
      });
    }
  }

  // Fetch the first quote once the profile exists (quotes are per guest).
  const fetchQuoteOnce = useEffectEvent(() => {
    if (requested.current) return;
    requested.current = true;
    void fetchQuote();
  });
  useEffect(() => {
    if (profileReady && !reservationParam) fetchQuoteOnce();
  }, [profileReady, reservationParam]);

  async function confirm(quote: Quote) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const reservation = await createReservation({
        quoteId: quote.quoteId,
        idempotencyKey: quote.idempotencyKey,
      });
      if (reservation.paymentStatus === "hold") {
        await capture({
          reservationId: reservation._id,
          idempotencyKey: `guest:${reservation._id}`,
        }).catch(() => {
          // The progress panel offers a retry while the hold lasts.
        });
      }
      const params = new URLSearchParams(searchParams);
      params.set("reservation", reservation._id);
      router.replace(`/listings/${listingId}/checkout?${params}`, {
        scroll: false,
      });
    } catch (caught) {
      const code = codeOf(caught);
      if (code === "QUOTE_EXPIRED") {
        setSubmitError(
          "Your price quote expired before we could book it. We've fetched a fresh one; check the total and confirm again.",
        );
        await fetchQuote();
      } else if (code === "UNAVAILABLE") {
        setQuoteState({
          kind: "failed",
          code,
          message: "Those dates were just booked by someone else.",
        });
      } else {
        setSubmitError(
          errorMessage(caught, "We couldn't complete the booking."),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!stay.checkIn || !stay.checkOut) {
    return (
      <Shell backHref={listingHref(false)}>
        <Recovery
          title="Choose your dates first"
          body="Pick check-in and checkout dates on the listing to see a price."
          href={listingHref(false)}
          label="Choose dates"
        />
      </Shell>
    );
  }

  if (listing === null) {
    return (
      <Shell backHref="/">
        <Recovery
          title="This stay isn't taking bookings"
          body="The host may have unpublished it. Nothing was charged."
          href="/"
          label="Browse other stays"
        />
      </Shell>
    );
  }

  const quote = quoteState.kind === "ready" ? quoteState.value : null;
  const quoteLeft = quote ? formatCountdown(quote.expiresAt, now) : null;
  const isRequest = listing?.bookingMode === "request";

  return (
    <Shell backHref={listingHref(true)}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.05em]">
          {reservationParam
            ? "Your booking"
            : isRequest
              ? "Request to book"
              : "Confirm and pay"}
        </h1>
        <SimulationBadge>Test mode · no real charges</SimulationBadge>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {reservationParam ? (
            trip === undefined ? (
              <p role="status" className="text-checkin-muted">
                Loading your booking…
              </p>
            ) : (
              <>
                <ReservationProgress
                  reservation={trip.reservation}
                  chargeProcessing={trip.chargeProcessing}
                  retryHref={listingHref(false)}
                />
                <Link
                  href={`/trips/${trip.reservation._id}`}
                  className="inline-block text-sm font-semibold underline underline-offset-4"
                >
                  View trip details
                </Link>
              </>
            )
          ) : quoteState.kind === "failed" ? (
            <Recovery
              title={
                quoteState.code === "UNAVAILABLE"
                  ? "Those dates aren't available anymore"
                  : "We couldn't price this stay"
              }
              body={quoteState.message}
              href={listingHref(false)}
              label="Pick new dates"
              icon={<CalendarX aria-hidden className="size-6" />}
            />
          ) : (
            <section aria-labelledby="trip-heading" className="space-y-4">
              <h2 id="trip-heading" className="text-xl font-semibold">
                Your trip
              </h2>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-semibold">Dates</dt>
                  <dd className="text-sm text-checkin-muted">
                    {formatStayDate(stay.checkIn)} –{" "}
                    {formatStayDate(stay.checkOut)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Guests</dt>
                  <dd className="text-sm text-checkin-muted">
                    {stay.guests} {stay.guests === 1 ? "guest" : "guests"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Free cancellation</dt>
                  <dd className="text-sm text-checkin-muted">
                    {quote && listing
                      ? `Until ${formatLocalDateTime(quote.quote.cancellationDeadline, listing.timezone)}`
                      : "Until 24 hours before check-in"}
                  </dd>
                </div>
              </dl>
              <Link
                href={listingHref(true)}
                className="inline-block text-sm font-semibold underline underline-offset-4"
              >
                Change dates or guests
              </Link>
              <p className="rounded-[0.9rem] bg-checkin-mist/50 px-4 py-3 text-sm">
                {isRequest
                  ? "You're sending a request. The host has 24 hours to accept; once they do, you'll have up to 24 hours to complete a simulated payment."
                  : "Confirming holds these dates for 15 minutes while a simulated payment runs. No real card is used."}
              </p>
              {submitError ? (
                <p
                  role="alert"
                  className="text-sm font-medium text-checkin-signal"
                >
                  {submitError}
                </p>
              ) : null}
              {quote && !quoteLeft ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-3 rounded-[0.9rem] border border-checkin-line px-4 py-3 text-sm"
                >
                  <Clock aria-hidden className="size-4" />
                  This price quote has expired.
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void fetchQuote()}
                  >
                    Refresh price
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="signal"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={!quote || submitting}
                  onClick={() => quote && void confirm(quote)}
                >
                  {submitting
                    ? "Booking…"
                    : isRequest
                      ? "Send request"
                      : `Confirm and pay${quote ? ` ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(quote.quote.totalCents / 100)}` : ""} (simulated)`}
                </Button>
              )}
              {quote && quoteLeft ? (
                <p className="text-xs text-checkin-muted">
                  This price is held for{" "}
                  <span className="tabular-nums">{quoteLeft}</span>.
                </p>
              ) : null}
            </section>
          )}
        </div>

        <aside aria-label="Price summary">
          <Surface className="p-5">
            {listing ? (
              <div className="flex gap-4 border-b border-checkin-line pb-5">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-[0.8rem]">
                  <ListingPhoto
                    src={listing.photos[0]?.url}
                    alt={listing.title}
                    sizes="96px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{listing.title}</p>
                  <p className="text-sm text-checkin-muted">
                    {listing.publicLocation.city}
                  </p>
                </div>
              </div>
            ) : null}
            <h2 className="mt-5 font-semibold">Price details</h2>
            {trip ? (
              <PriceBreakdown quote={trip.reservation.quote} className="mt-3" />
            ) : quote ? (
              <PriceBreakdown quote={quote.quote} className="mt-3" />
            ) : quoteState.kind === "loading" ? (
              <p role="status" className="mt-3 text-sm text-checkin-muted">
                Getting the latest price…
              </p>
            ) : (
              <p className="mt-3 text-sm text-checkin-muted">
                No price available.
              </p>
            )}
          </Surface>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({
  backHref,
  children,
}: {
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={backHref}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft aria-hidden className="size-4" /> Back to the stay
      </Link>
      {children}
    </main>
  );
}

function Recovery({
  title,
  body,
  href,
  label,
  icon,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[1rem] border border-checkin-line bg-checkin-paper p-6"
    >
      {icon ? <span className="text-checkin-signal">{icon}</span> : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-checkin-muted">{body}</p>
      <Link
        href={href}
        className="inline-flex h-11 items-center rounded-[0.8rem] bg-checkin-ink px-4 text-sm font-semibold text-checkin-canvas focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
      >
        {label}
      </Link>
    </div>
  );
}
