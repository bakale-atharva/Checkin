"use client";

import { useMutation } from "convex/react";
import { CheckCircle2, Clock, CreditCard, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import {
  errorMessage,
  SimulationBadge,
} from "@/components/hosting/form-controls";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { formatCountdown, useNow } from "./use-now";

/**
 * Where a reservation stands in booking: request awaiting the host, payment
 * hold awaiting the guest, processing, confirmed, or released. Used by checkout
 * and the trip page so a guest can always finish or recover a booking.
 */
export function ReservationProgress({
  reservation,
  chargeProcessing,
  retryHref,
}: {
  reservation: Doc<"reservations">;
  chargeProcessing: boolean;
  retryHref: string | null;
}) {
  const now = useNow();
  const capture = useMutation(api.reservations.capturePayment);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      // One key per reservation: retries after a network error can't double-charge.
      await capture({
        reservationId: reservation._id,
        idempotencyKey: `guest:${reservation._id}`,
      });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't start the simulated payment."));
    } finally {
      setPaying(false);
    }
  }

  const { status, paymentStatus } = reservation;

  if (status === "confirmed" || status === "completed")
    return (
      <Panel
        tone="good"
        icon={<CheckCircle2 aria-hidden className="size-5" />}
        title="You're booked"
      >
        Your simulated payment of{" "}
        {formatNightlyPrice(reservation.quote.totalCents)} went through. The
        exact address and check-in details are on your trip page.
      </Panel>
    );

  if (status === "declined")
    return (
      <Panel
        tone="bad"
        icon={<XCircle aria-hidden className="size-5" />}
        title="The host declined this request"
        action={<RetryLink href={retryHref} label="Find other dates" />}
      >
        You weren&apos;t charged. Try different dates or another stay.
      </Panel>
    );

  if (status === "expired")
    return (
      <Panel
        tone="bad"
        icon={<XCircle aria-hidden className="size-5" />}
        title={
          paymentStatus === "declined"
            ? "Payment didn't go through"
            : "This booking expired"
        }
        action={<RetryLink href={retryHref} label="Try again" />}
      >
        {paymentStatus === "declined"
          ? "The simulated payment was declined or the hold ran out, so the dates were released. You weren't charged."
          : "The host didn't respond in time, so the request lapsed. You weren't charged."}
      </Panel>
    );

  if (status === "cancelled")
    return (
      <Panel
        tone="bad"
        icon={<XCircle aria-hidden className="size-5" />}
        title="This reservation was cancelled"
      >
        Any simulated payment is refunded in full.
      </Panel>
    );

  // Pending: either awaiting the host, or holding the dates for payment.
  if (paymentStatus === "not_required") {
    const left = reservation.requestExpiresAt
      ? formatCountdown(reservation.requestExpiresAt, now)
      : null;
    return (
      <Panel
        tone="wait"
        icon={<Clock aria-hidden className="size-5" />}
        title="Request sent"
      >
        The host has {left ?? "a little time"} to respond. Your dates
        aren&apos;t held yet, and you won&apos;t be charged unless they accept.
      </Panel>
    );
  }

  const holdLeft = reservation.paymentHoldExpiresAt
    ? formatCountdown(reservation.paymentHoldExpiresAt, now)
    : null;

  if (chargeProcessing)
    return (
      <Panel
        tone="wait"
        icon={<CreditCard aria-hidden className="size-5" />}
        title="Processing simulated payment…"
      >
        <span role="status">
          This usually takes a moment. You can leave this page; we&apos;ll
          update your trip when it finishes.
        </span>
      </Panel>
    );

  return (
    <Panel
      tone="wait"
      icon={<CreditCard aria-hidden className="size-5" />}
      title={
        reservation.bookingMode === "request"
          ? "The host accepted. Pay to confirm"
          : "Your dates are held"
      }
      action={
        holdLeft ? (
          <Button
            type="button"
            variant="signal"
            disabled={paying}
            onClick={() => void pay()}
          >
            {paying
              ? "Starting payment…"
              : `Pay ${formatNightlyPrice(reservation.quote.totalCents)} (simulated)`}
          </Button>
        ) : (
          <RetryLink href={retryHref} label="Start over" />
        )
      }
    >
      {holdLeft ? (
        <>
          Complete the simulated payment within{" "}
          <span className="font-semibold tabular-nums">{holdLeft}</span> or the
          dates are released.
        </>
      ) : (
        "The payment hold has run out and the dates are being released."
      )}
      {error ? (
        <span
          role="alert"
          className="mt-2 block font-medium text-checkin-signal"
        >
          {error}
        </span>
      ) : null}
    </Panel>
  );
}

function Panel({
  tone,
  icon,
  title,
  action,
  children,
}: {
  tone: "good" | "bad" | "wait";
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const accent =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-checkin-signal"
        : "text-checkin-ink";
  return (
    <div className="rounded-[1rem] border border-checkin-line bg-checkin-paper p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={accent}>{icon}</span>
        <h2 className="font-semibold">{title}</h2>
        <SimulationBadge />
      </div>
      <p className="mt-2 text-sm text-checkin-muted">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function RetryLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-[0.8rem] bg-checkin-ink px-4 text-sm font-semibold text-checkin-canvas focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
    >
      {label}
    </Link>
  );
}
