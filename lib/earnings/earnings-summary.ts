import type {
  PaymentStatus,
  ReservationStatus,
} from "../reservations/reservation-policy";

export type EarningsReservation = {
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  checkIn: string;
  quote: {
    nightlyCharges: { date: string; amountCents: number }[];
    cleaningFeeCents: number;
    totalCents: number;
  };
};

export type MonthSummary = {
  /** YYYY-MM */
  month: string;
  bookedNights: number;
  availableNights: number;
  /** 0–1; zero when there is nothing to book. */
  occupancyRate: number;
  /** Simulated host proceeds: accommodation by night plus cleaning on check-in. */
  earnedCents: number;
  /** Simulated guest refunds for stays checking in this month. */
  refundedCents: number;
};

/** `count` consecutive YYYY-MM months starting `before` months ahead of `today`'s month. */
export function monthWindow(today: string, before: number, count: number) {
  const [year, month] = today.split("-").map(Number);
  const start = year * 12 + (month - 1) - before;
  return Array.from({ length: count }, (_, index) => {
    const value = start + index;
    return `${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, "0")}`;
  });
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

const earning = new Set<ReservationStatus>(["confirmed", "completed"]);

/**
 * Monthly occupancy and simulated earnings. Figures are derived only from the
 * immutable booking snapshots, so they always reconcile with reservations.
 */
export function summarizeEarnings(
  reservations: EarningsReservation[],
  months: string[],
  listingCount: number,
): MonthSummary[] {
  const byMonth = new Map(
    months.map((month) => [
      month,
      {
        month,
        bookedNights: 0,
        availableNights: daysInMonth(month) * listingCount,
        occupancyRate: 0,
        earnedCents: 0,
        refundedCents: 0,
      },
    ]),
  );
  for (const reservation of reservations) {
    if (earning.has(reservation.status)) {
      for (const night of reservation.quote.nightlyCharges) {
        const summary = byMonth.get(night.date.slice(0, 7));
        if (!summary) continue;
        summary.bookedNights += 1;
        summary.earnedCents += night.amountCents;
      }
      const arrival = byMonth.get(reservation.checkIn.slice(0, 7));
      if (arrival) arrival.earnedCents += reservation.quote.cleaningFeeCents;
    }
    if (reservation.paymentStatus === "refunded") {
      const arrival = byMonth.get(reservation.checkIn.slice(0, 7));
      if (arrival) arrival.refundedCents += reservation.quote.totalCents;
    }
  }
  return months.map((month) => {
    const summary = byMonth.get(month)!;
    return {
      ...summary,
      occupancyRate:
        summary.availableNights > 0
          ? Math.min(1, summary.bookedNights / summary.availableNights)
          : 0,
    };
  });
}
