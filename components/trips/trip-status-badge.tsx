import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

/** Plain-language reservation state, separating booking status from payment. */
export function tripStatusLabel(reservation: Doc<"reservations">) {
  const { status, paymentStatus, bookingMode } = reservation;
  if (status === "pending") {
    if (paymentStatus === "not_required") return "Awaiting host";
    return bookingMode === "request" ? "Accepted · payment due" : "Payment due";
  }
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  if (status === "declined") return "Declined by host";
  if (status === "expired")
    return paymentStatus === "declined" ? "Payment failed" : "Expired";
  if (paymentStatus === "refunded") return "Cancelled · refunded";
  if (paymentStatus === "refund_failed") return "Cancelled · refund delayed";
  if (paymentStatus === "paid") return "Cancelled · refund processing";
  return "Cancelled";
}

export function TripStatusBadge({
  reservation,
  className,
}: {
  reservation: Doc<"reservations">;
  className?: string;
}) {
  const { status } = reservation;
  const tone =
    status === "confirmed" || status === "completed"
      ? "bg-checkin-mist text-checkin-ink"
      : status === "pending"
        ? "border border-checkin-ink/25 bg-checkin-paper text-checkin-ink"
        : "bg-checkin-line/60 text-checkin-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      {tripStatusLabel(reservation)}
    </span>
  );
}
