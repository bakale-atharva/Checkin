"use client";

import { useMutation } from "convex/react";
import { useRef, useState, type FormEvent } from "react";

import {
  errorMessage,
  Field,
  TextArea,
} from "@/components/hosting/form-controls";
import { formatLocalDateTime } from "@/components/listing/price-breakdown";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { previewGuestCancellation } from "@/lib/reservations/cancellation-preview";

/**
 * Cancel button plus a confirmation dialog that previews the refund before the
 * guest commits. Inside 24 hours of check-in it files a support request instead.
 */
export function CancelTripDialog({
  reservation,
  timezone,
  supportPending,
}: {
  reservation: Doc<"reservations">;
  timezone: string;
  supportPending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancel = useMutation(api.reservations.cancel);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState(() => new Date().toISOString());

  const preview = previewGuestCancellation(
    {
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      checkInAt: reservation.checkInAt,
      totalCents: reservation.quote.totalCents,
    },
    openedAt,
  );
  if (preview.kind === "not_cancellable") return null;
  const late = preview.kind === "support_required";

  if (late && supportPending)
    return (
      <p className="text-sm text-checkin-muted">
        Your late-cancellation request is with Checkin support.
      </p>
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await cancel({ reservationId: reservation._id, reason: reason.trim() });
      dialogRef.current?.close();
    } catch (caught) {
      setError(errorMessage(caught, "We couldn't cancel this reservation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpenedAt(new Date().toISOString());
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {late ? "Request cancellation" : "Cancel reservation"}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="cancel-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[1.1rem] border border-checkin-line bg-checkin-paper p-0 text-checkin-ink backdrop:bg-checkin-ink/50"
      >
        <form onSubmit={submit} className="space-y-5 p-6">
          <h2 id="cancel-title" className="text-xl font-semibold">
            {late ? "Request a late cancellation" : "Cancel this reservation?"}
          </h2>
          <div className="rounded-[0.9rem] bg-checkin-mist/50 px-4 py-3 text-sm">
            {preview.kind === "full_refund" ? (
              <>
                <p className="font-semibold">
                  Full refund: {formatNightlyPrice(preview.refundCents)}{" "}
                  (simulated)
                </p>
                <p className="mt-1 text-checkin-muted">
                  You&apos;re inside the free-cancellation window, which ends{" "}
                  {formatLocalDateTime(
                    reservation.cancellationDeadline,
                    timezone,
                  )}
                  . The dates are released straight away.
                </p>
              </>
            ) : preview.kind === "no_charge" ? (
              <p>
                You haven&apos;t been charged, so there&apos;s nothing to
                refund. The dates are released straight away.
              </p>
            ) : (
              <>
                <p className="font-semibold">
                  Check-in is less than 24 hours away
                </p>
                <p className="mt-1 text-checkin-muted">
                  Free cancellation ended{" "}
                  {formatLocalDateTime(
                    reservation.cancellationDeadline,
                    timezone,
                  )}
                  . Your reservation stays active while Checkin support reviews
                  the request
                  {preview.paidCents > 0
                    ? ` and decides on a refund of up to ${formatNightlyPrice(preview.paidCents)} (simulated)`
                    : ""}
                  .
                </p>
              </>
            )}
          </div>
          <Field
            label={late ? "What happened?" : "Reason (optional)"}
            htmlFor="cancel-reason"
            hint={late ? "Support reads this before deciding." : undefined}
          >
            <TextArea
              id="cancel-reason"
              required={late}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-24"
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-checkin-signal">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => dialogRef.current?.close()}
            >
              Keep reservation
            </Button>
            <Button
              type="submit"
              variant="signal"
              disabled={busy || (late && !reason.trim())}
            >
              {busy
                ? "Sending…"
                : late
                  ? "Send to support"
                  : "Cancel reservation"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
