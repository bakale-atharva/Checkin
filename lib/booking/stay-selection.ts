import {
  createReservationQuote,
  type ReservationQuote,
} from "../reservations/reservation-policy";

export const MAX_STAY_NIGHTS = 28;

export type StaySelection = { checkIn?: string; checkOut?: string };

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function utc(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number) {
  return new Date(utc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((utc(checkOut) - utc(checkIn)) / 86_400_000);
}

/** Today's date in the given IANA timezone, as YYYY-MM-DD. */
export function todayIn(timezone: string, now = Date.now()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

/**
 * Weeks of a month (Sunday first) as ISO dates, padded with nulls. `month` is
 * zero-based, matching `Date`.
 */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from(
    { length: first.getUTCDay() },
    () => null,
  );
  for (let day = 1; day <= days; day += 1)
    cells.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7)
    weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** True when any night of the stay (checkout is exclusive) is unavailable. */
export function stayHasUnavailableNight(
  checkIn: string,
  checkOut: string,
  unavailable: ReadonlySet<string>,
) {
  for (let date = checkIn; date < checkOut; date = addDays(date, 1))
    if (unavailable.has(date)) return true;
  return false;
}

/**
 * Whether a calendar day can be clicked. With a check-in chosen, a booked day
 * can still be the checkout because checkout mornings don't use the night.
 */
export function canSelectDate(
  date: string,
  selection: StaySelection,
  unavailable: ReadonlySet<string>,
  today: string,
) {
  if (date < today) return false;
  const { checkIn, checkOut } = selection;
  if (checkIn && !checkOut && date > checkIn) {
    return (
      nightsBetween(checkIn, date) <= MAX_STAY_NIGHTS &&
      !stayHasUnavailableNight(checkIn, date, unavailable)
    );
  }
  return !unavailable.has(date);
}

/** The selection after clicking `date`: start a stay, finish it, or restart. */
export function nextStaySelection(
  selection: StaySelection,
  date: string,
  unavailable: ReadonlySet<string>,
): StaySelection {
  const { checkIn, checkOut } = selection;
  if (
    checkIn &&
    !checkOut &&
    date > checkIn &&
    nightsBetween(checkIn, date) <= MAX_STAY_NIGHTS &&
    !stayHasUnavailableNight(checkIn, date, unavailable)
  )
    return { checkIn, checkOut: date };
  return unavailable.has(date) ? {} : { checkIn: date };
}

/** Parses stay dates from the URL, dropping anything the booking rules reject. */
export function parseStayParams(params: {
  get(name: string): string | null;
}): StaySelection & { guests: number } {
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const guests = Number(params.get("guests"));
  const datesValid =
    isoDate.test(checkIn) &&
    isoDate.test(checkOut) &&
    !Number.isNaN(utc(checkIn)) &&
    !Number.isNaN(utc(checkOut)) &&
    nightsBetween(checkIn, checkOut) >= 1 &&
    nightsBetween(checkIn, checkOut) <= MAX_STAY_NIGHTS;
  // A lone check-in is a stay still being picked in the calendar.
  const checkInOnly =
    !checkOut && isoDate.test(checkIn) && !Number.isNaN(utc(checkIn));
  return {
    ...(datesValid ? { checkIn, checkOut } : checkInOnly ? { checkIn } : {}),
    guests: Number.isInteger(guests) && guests >= 1 ? guests : 1,
  };
}

/**
 * A client-side price estimate using the same rules as the server quote. The
 * server quote stays authoritative; this returns null when the stay is invalid.
 */
export function estimateStay(input: {
  checkIn: string;
  checkOut: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  nightlyPriceOverrides: Record<string, number>;
}): ReservationQuote | null {
  try {
    return createReservationQuote(input);
  } catch {
    return null;
  }
}
