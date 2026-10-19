"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, KeyRound, LifeBuoy, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ReservationProgress } from "@/components/booking/reservation-progress";
import { ListingPhoto } from "@/components/discovery/listing-photo";
import { SimulationBadge } from "@/components/hosting/form-controls";
import { MessageButton } from "@/components/messaging/message-button";
import { ReviewPanel } from "@/components/reviews/review-panel";
import {
  formatLocalDateTime,
  PriceBreakdown,
} from "@/components/listing/price-breakdown";
import { Surface } from "@/components/ui/surface";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { CancelTripDialog } from "./cancel-trip-dialog";
import { TripStatusBadge } from "./trip-status-badge";

type TripDetailData = {
  reservation: Doc<"reservations">;
  listing: {
    id: Id<"listings">;
    title: string;
    city: string;
    region?: string;
    countryCode: string;
    timezone: string;
    bookable: boolean;
    coverPhotoUrl: string | null;
    address: Doc<"listings">["privateAddress"] | null;
  } | null;
  hostFirstName: string | null;
  chargeProcessing: boolean;
  refund: {
    status: "pending" | "succeeded" | "declined" | "failed";
    amountCents: number;
  } | null;
  supportRequest: {
    status: "open" | "resolved";
    resolution: "refund_approved" | "declined" | null;
    createdAt: number;
  } | null;
};

export function TripDetail() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const profileReady = useProfileReady();
  const trip = useQuery(
    api.dashboard.tripDetail,
    profileReady
      ? { reservationId: reservationId as Id<"reservations"> }
      : "skip",
  ) as TripDetailData | undefined;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/trips"
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft aria-hidden className="size-4" /> Trips
      </Link>
      {trip === undefined ? (
        <p role="status" className="text-checkin-muted">
          Loading trip…
        </p>
      ) : (
        <TripBody trip={trip} />
      )}
    </main>
  );
}

function TripBody({ trip }: { trip: TripDetailData }) {
  const { reservation, listing } = trip;
  const timezone = listing?.timezone ?? "UTC";
  const place = listing
    ? [listing.city, listing.region].filter(Boolean).join(", ")
    : "Removed listing";
  const showProgress = reservation.status !== "confirmed";

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
        <div className="relative aspect-[3/2] overflow-hidden rounded-[1.1rem] bg-checkin-mist">
          <ListingPhoto
            src={listing?.coverPhotoUrl}
            alt={listing?.title ?? "Listing"}
            sizes="(min-width: 640px) 12rem, 100vw"
          />
        </div>
        <div className="min-w-0">
          <TripStatusBadge reservation={reservation} />
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            {place}
          </h1>
          <p className="truncate text-checkin-muted">
            {listing?.title}
            {trip.hostFirstName ? ` · Hosted by ${trip.hostFirstName}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <MessageButton
              reservationId={reservation._id}
              label={
                trip.hostFirstName
                  ? `Message ${trip.hostFirstName}`
                  : "Message host"
              }
              size="sm"
            />
            {listing?.bookable ? (
              <Link
                href={`/listings/${listing.id}`}
                className="inline-block text-sm font-semibold underline underline-offset-4"
              >
                View listing
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          {showProgress ? (
            <ReservationProgress
              reservation={reservation}
              chargeProcessing={trip.chargeProcessing}
              retryHref={listing?.bookable ? `/listings/${listing.id}` : "/"}
            />
          ) : null}

          <section aria-labelledby="stay-heading">
            <h2 id="stay-heading" className="text-xl font-semibold">
              Your stay
            </h2>
            <dl className="mt-4 grid gap-5 sm:grid-cols-2">
              <Detail label="Check-in">
                {formatLocalDateTime(reservation.checkInAt, timezone)}
              </Detail>
              <Detail label="Checkout">
                {formatLocalDateTime(reservation.checkOutAt, timezone)}
              </Detail>
              <Detail label="Guests">
                {reservation.guests}{" "}
                {reservation.guests === 1 ? "guest" : "guests"}
              </Detail>
              <Detail label="Booking type">
                {reservation.bookingMode === "instant"
                  ? "Instant book"
                  : "Request to book"}
              </Detail>
            </dl>
          </section>

          <section aria-labelledby="address-heading">
            <h2
              id="address-heading"
              className="flex items-center gap-2 text-xl font-semibold"
            >
              {listing?.address ? (
                <KeyRound aria-hidden className="size-5" />
              ) : (
                <MapPin aria-hidden className="size-5" />
              )}
              Getting there
            </h2>
            {listing?.address ? (
              <address className="mt-3 not-italic leading-relaxed">
                {listing.address.line1}
                {listing.address.line2 ? (
                  <>
                    <br />
                    {listing.address.line2}
                  </>
                ) : null}
                <br />
                {[listing.address.city, listing.address.region]
                  .filter(Boolean)
                  .join(", ")}{" "}
                {listing.address.postalCode}
                <br />
                {listing.address.countryCode}
              </address>
            ) : (
              <p className="mt-3 text-sm text-checkin-muted">
                The exact address appears here once the reservation is
                confirmed. Until then: {place}.
              </p>
            )}
          </section>

          <CancellationSection trip={trip} timezone={timezone} />

          {reservation.status === "completed" ? (
            <section aria-labelledby="review-heading" className="space-y-3">
              <h2 id="review-heading" className="text-xl font-semibold">
                Review
              </h2>
              <ReviewPanel reservationId={reservation._id} />
            </section>
          ) : null}
        </div>

        <aside aria-label="Payment summary" className="space-y-4">
          <Surface className="p-5">
            <h2 className="font-semibold">Payment</h2>
            <PriceBreakdown quote={reservation.quote} className="mt-3" />
            <PaymentState trip={trip} />
          </Surface>
        </aside>
      </div>
    </>
  );
}

function CancellationSection({
  trip,
  timezone,
}: {
  trip: TripDetailData;
  timezone: string;
}) {
  const { reservation, supportRequest } = trip;
  const active =
    reservation.status === "pending" || reservation.status === "confirmed";
  if (!active && !supportRequest) return null;
  return (
    <section aria-labelledby="cancel-heading" className="space-y-3">
      <h2 id="cancel-heading" className="text-xl font-semibold">
        Cancellation
      </h2>
      <p className="text-sm text-checkin-muted">
        Free cancellation with a full simulated refund until{" "}
        {formatLocalDateTime(reservation.cancellationDeadline, timezone)}. After
        that, requests go to Checkin support.
      </p>
      {supportRequest ? (
        <div className="flex gap-3 rounded-[0.9rem] border border-checkin-line px-4 py-3 text-sm">
          <LifeBuoy aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            {supportRequest.status === "open"
              ? "Support is reviewing your late-cancellation request. Your reservation stays active until they decide."
              : supportRequest.resolution === "refund_approved"
                ? "Support approved your request and cancelled the stay with a refund."
                : "Support reviewed your request and kept the reservation in place."}
          </p>
        </div>
      ) : null}
      {active ? (
        <CancelTripDialog
          reservation={reservation}
          timezone={timezone}
          supportPending={supportRequest?.status === "open"}
        />
      ) : null}
    </section>
  );
}

function PaymentState({ trip }: { trip: TripDetailData }) {
  const { reservation, refund } = trip;
  const lines: string[] = [];
  if (reservation.paymentStatus === "paid")
    lines.push(
      reservation.status === "cancelled"
        ? "Refund processing."
        : "Paid in full.",
    );
  if (reservation.paymentStatus === "hold")
    lines.push("Dates held, payment not taken yet.");
  if (reservation.paymentStatus === "not_required")
    lines.push("No payment until the host accepts.");
  if (reservation.paymentStatus === "declined")
    lines.push("Payment declined. Nothing was charged.");
  if (reservation.paymentStatus === "refunded" && refund)
    lines.push(`Refunded ${formatNightlyPrice(refund.amountCents)}.`);
  if (reservation.paymentStatus === "refund_failed")
    lines.push(
      "The refund hit a snag and support is retrying it. You don't need to do anything.",
    );
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-checkin-line pt-4 text-sm">
      <SimulationBadge />
      <span className="text-checkin-muted">{lines.join(" ")}</span>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className="text-sm text-checkin-muted">{children}</dd>
    </div>
  );
}
