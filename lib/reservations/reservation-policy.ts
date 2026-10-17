const SERVICE_FEE_BASIS_POINTS = 1_000;
const BASIS_POINTS = 10_000;

export class ReservationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationPolicyError";
  }
}

export type NightlyCharge = { date: string; amountCents: number };

export type ReservationQuote = {
  nightlyCharges: NightlyCharge[];
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

export type ReservationStatus =
  "pending" | "confirmed" | "cancelled" | "completed" | "declined" | "expired";

export type PaymentStatus =
  "not_required" | "hold" | "paid" | "declined" | "refunded" | "refund_failed";

type QuoteInput = {
  checkIn: string;
  checkOut: string;
  timezone: string;
  checkInTime?: string;
  checkOutTime?: string;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  nightlyPriceOverrides: Record<string, number>;
};

function parseStayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ReservationPolicyError("Dates must use YYYY-MM-DD format.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ReservationPolicyError("Dates must be real calendar dates.");
  }
  return date;
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addLocalDays(date: string, days: number) {
  const result = parseStayDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return dateString(result);
}

function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new ReservationPolicyError("The property timezone is invalid.");
  }
}

function validateMoney(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ReservationPolicyError(
      `${label} must be a non-negative integer amount in cents.`,
    );
  }
}

function validateTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ReservationPolicyError("Check-in time must use HH:mm format.");
  }
}

function timezoneOffsetMinutes(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((localAsUtc - timestamp) / 60_000);
}

function formatOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function localDateTimeWithOffset(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let offset = timezoneOffsetMinutes(localAsUtc, timezone);
  offset = timezoneOffsetMinutes(localAsUtc - offset * 60_000, timezone);
  const timestamp = localAsUtc - offset * 60_000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const actual = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  if (
    Number(actual.year) !== year ||
    Number(actual.month) !== month ||
    Number(actual.day) !== day ||
    Number(actual.hour) !== hour ||
    Number(actual.minute) !== minute
  ) {
    throw new ReservationPolicyError(
      "The property-local time does not exist in its timezone.",
    );
  }
  // Repeated wall times consistently resolve to the earlier matching instant.
  return `${date}T${time}:00.000${formatOffset(offset)}`;
}

export function stayDates(checkIn: string, checkOut: string) {
  const start = parseStayDate(checkIn);
  const end = parseStayDate(checkOut);
  const nights = (end.getTime() - start.getTime()) / 86_400_000;
  if (!Number.isInteger(nights) || nights < 1 || nights > 28) {
    throw new ReservationPolicyError(
      "Stays must be between one and twenty-eight nights.",
    );
  }
  return Array.from({ length: nights }, (_, index) =>
    addLocalDays(checkIn, index),
  );
}

export function datesOverlap(
  leftCheckIn: string,
  leftCheckOut: string,
  rightCheckIn: string,
  rightCheckOut: string,
) {
  return leftCheckIn < rightCheckOut && rightCheckIn < leftCheckOut;
}

export function createReservationQuote(input: QuoteInput): ReservationQuote {
  validateTimezone(input.timezone);
  validateTime(input.checkInTime ?? "15:00");
  validateTime(input.checkOutTime ?? "11:00");
  validateMoney(input.nightlyPriceCents, "Nightly price");
  validateMoney(input.cleaningFeeCents, "Cleaning fee");
  const dates = stayDates(input.checkIn, input.checkOut);
  const nightlyCharges = dates.map((date) => {
    const amountCents =
      input.nightlyPriceOverrides[date] ?? input.nightlyPriceCents;
    validateMoney(amountCents, "Nightly price override");
    return { date, amountCents };
  });
  const accommodationCents = nightlyCharges.reduce(
    (total, charge) => total + charge.amountCents,
    0,
  );
  const serviceFeeCents = Math.round(
    (accommodationCents * SERVICE_FEE_BASIS_POINTS) / BASIS_POINTS,
  );
  const taxCents = 0;
  const totalCents =
    accommodationCents + input.cleaningFeeCents + serviceFeeCents + taxCents;
  const checkInAt = localDateTimeWithOffset(
    input.checkIn,
    input.checkInTime ?? "15:00",
    input.timezone,
  );
  const cancellationDeadline = new Date(
    Date.parse(checkInAt) - 24 * 60 * 60 * 1000,
  ).toISOString();
  const checkOutAt = localDateTimeWithOffset(
    input.checkOut,
    input.checkOutTime ?? "11:00",
    input.timezone,
  );
  return {
    nightlyCharges,
    accommodationCents,
    cleaningFeeCents: input.cleaningFeeCents,
    serviceFeeCents,
    taxCents,
    totalCents,
    hostProceedsCents: accommodationCents + input.cleaningFeeCents,
    checkInAt,
    checkOutAt,
    cancellationDeadline,
  };
}

export function isCancellationRefundEligible(checkInAt: string, now: string) {
  const checkIn = Date.parse(checkInAt);
  const requestedAt = Date.parse(now);
  if (Number.isNaN(checkIn) || Number.isNaN(requestedAt)) {
    throw new ReservationPolicyError(
      "Cancellation times must be valid ISO timestamps.",
    );
  }
  return requestedAt <= checkIn - 24 * 60 * 60 * 1000;
}

export function reservationForBookingMode(bookingMode: "instant" | "request") {
  return bookingMode === "instant"
    ? {
        reservationStatus: "pending" as const,
        inventoryReserved: true,
        paymentStatus: "hold" as const,
      }
    : {
        reservationStatus: "pending" as const,
        inventoryReserved: false,
        paymentStatus: "not_required" as const,
      };
}

const validReservationTransitions: Record<
  ReservationStatus,
  readonly ReservationStatus[]
> = {
  pending: ["confirmed", "cancelled", "declined", "expired"],
  confirmed: ["cancelled", "completed"],
  cancelled: [],
  completed: [],
  declined: [],
  expired: [],
};

export function transitionReservation(
  current: ReservationStatus,
  next: ReservationStatus,
) {
  if (!validReservationTransitions[current].includes(next)) {
    throw new ReservationPolicyError(
      `Cannot transition a ${current} reservation to ${next}.`,
    );
  }
  return next;
}
