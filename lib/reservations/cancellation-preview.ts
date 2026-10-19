import {
  isCancellationRefundEligible,
  type PaymentStatus,
  type ReservationStatus,
} from "./reservation-policy";

export type CancellationPreview =
  | { kind: "not_cancellable" }
  /** Cancels now; a paid stay gets a full simulated refund. */
  | { kind: "full_refund"; refundCents: number }
  /** Cancels now; nothing was charged so nothing is refunded. */
  | { kind: "no_charge" }
  /** Inside 24 hours of check-in: routed to support review instead. */
  | { kind: "support_required"; paidCents: number };

/**
 * What happens if the guest cancels right now. Mirrors `reservations.cancel`
 * so the preview never promises something the server won't do.
 */
export function previewGuestCancellation(
  reservation: {
    status: ReservationStatus;
    paymentStatus: PaymentStatus;
    checkInAt: string;
    totalCents: number;
  },
  now: string,
): CancellationPreview {
  if (reservation.status !== "pending" && reservation.status !== "confirmed")
    return { kind: "not_cancellable" };
  if (!isCancellationRefundEligible(reservation.checkInAt, now))
    return {
      kind: "support_required",
      paidCents:
        reservation.paymentStatus === "paid" ? reservation.totalCents : 0,
    };
  return reservation.paymentStatus === "paid"
    ? { kind: "full_refund", refundCents: reservation.totalCents }
    : { kind: "no_charge" };
}

export type TripGroup = "upcoming" | "past" | "cancelled";

/** Which tab a trip belongs in, based on status and the property-local checkout instant. */
export function tripGroup(
  reservation: { status: ReservationStatus; checkOutAt: string },
  now: number,
): TripGroup {
  if (
    reservation.status === "cancelled" ||
    reservation.status === "declined" ||
    reservation.status === "expired"
  )
    return "cancelled";
  if (reservation.status === "completed") return "past";
  return Date.parse(reservation.checkOutAt) <= now ? "past" : "upcoming";
}
