"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { Inbox } from "lucide-react";
import { useState } from "react";

import { MessageButton } from "@/components/messaging/message-button";
import { Button } from "@/components/ui/button";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { errorMessage, SimulationBadge } from "./form-controls";

type BookingRequest = Doc<"reservations"> & {
  listingTitle: string | null;
  guestFirstName: string | null;
};

const stayDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatStay(checkIn: string, checkOut: string) {
  const nights = Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) /
      86_400_000,
  );
  return `${stayDate.format(new Date(`${checkIn}T00:00:00Z`))} – ${stayDate.format(new Date(`${checkOut}T00:00:00Z`))} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

function formatExpiry(expiresAt: number | undefined, now: number) {
  if (!expiresAt) return null;
  const hours = Math.max(0, Math.round((expiresAt - now) / 3_600_000));
  return hours < 1 ? "Expires within the hour" : `Expires in ${hours} h`;
}

export function BookingRequests() {
  const profileReady = useProfileReady();
  const { results, status, loadMore } = usePaginatedQuery(
    api.dashboard.hostBookingRequests,
    profileReady ? {} : "skip",
    { initialNumItems: 10 },
  );
  const respond = useMutation(api.reservations.respondToRequest);
  const [pendingId, setPendingId] = useState<Id<"reservations"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const requests = results as BookingRequest[];

  async function answer(reservationId: Id<"reservations">, accept: boolean) {
    setPendingId(reservationId);
    setError(null);
    try {
      await respond({ reservationId, accept });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't update this request."));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section aria-labelledby="requests-heading" className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="requests-heading" className="text-xl font-semibold">
          Booking requests
        </h2>
        <SimulationBadge>Simulated payments</SimulationBadge>
      </div>
      <p className="mt-1 text-sm text-checkin-muted">
        Accepting holds the dates for up to 24 hours while the guest pays.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-3 text-sm font-medium text-checkin-signal"
        >
          {error}
        </p>
      ) : null}

      {status === "LoadingFirstPage" ? (
        <p className="mt-6 text-sm text-checkin-muted">Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-[1rem] border border-dashed border-checkin-line px-5 py-6 text-sm text-checkin-muted">
          <Inbox aria-hidden className="size-5 shrink-0" />
          No requests waiting on you. Listings set to request-to-book show new
          requests here.
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {requests.map((request) => {
            const awaitingPayment = request.paymentStatus === "hold";
            return (
              <li
                key={request._id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[1rem] border border-checkin-line bg-checkin-paper px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {request.guestFirstName ?? "A guest"} · {request.guests}{" "}
                    {request.guests === 1 ? "guest" : "guests"}
                  </p>
                  <p className="truncate text-sm text-checkin-muted">
                    {request.listingTitle ?? "Listing"} ·{" "}
                    {formatStay(request.checkIn, request.checkOut)}
                  </p>
                  <p className="text-sm text-checkin-muted">
                    You&apos;d earn{" "}
                    <span className="font-semibold text-checkin-ink">
                      {formatNightlyPrice(request.quote.hostProceedsCents)}
                    </span>{" "}
                    (simulated)
                    {awaitingPayment
                      ? " · Accepted — waiting for the guest's payment"
                      : formatExpiry(request.requestExpiresAt, now)
                        ? ` · ${formatExpiry(request.requestExpiresAt, now)}`
                        : ""}
                  </p>
                </div>
                {awaitingPayment ? (
                  <MessageButton
                    reservationId={request._id}
                    label="Message guest"
                    size="sm"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <MessageButton
                      reservationId={request._id}
                      label="Message"
                      variant="quiet"
                      size="sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingId === request._id}
                      onClick={() => void answer(request._id, false)}
                    >
                      Decline
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pendingId === request._id}
                      onClick={() => void answer(request._id, true)}
                    >
                      Accept
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => loadMore(10)}
        >
          Load more requests
        </Button>
      ) : null}
    </section>
  );
}
