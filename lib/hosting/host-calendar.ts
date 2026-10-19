const DAY_MS = 86_400_000;

/** Adds whole days to a `YYYY-MM-DD` date without touching local timezones. */
export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Consecutive `YYYY-MM-DD` dates starting at `start`. */
export function dateRange(start: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(start, index));
}

/** Today's date as the host sees it, as `YYYY-MM-DD`. */
export function localToday(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export type CalendarEntry =
  | {
      kind: "reservation";
      listingId: string;
      date: string;
      reservationId: string;
      status: string;
    }
  | { kind: "blocked"; listingId: string; date: string }
  | {
      kind: "price";
      listingId: string;
      date: string;
      nightlyPriceCents: number;
    };

export type CalendarDay = {
  date: string;
  reservation?: { reservationId: string; status: string };
  blocked: boolean;
  priceOverrideCents?: number;
};

const occupyingStatuses = new Set(["pending", "confirmed", "completed"]);

/** Folds calendar entries for one listing into a day-by-day view. */
export function buildCalendarDays(
  dates: readonly string[],
  entries: readonly CalendarEntry[],
): CalendarDay[] {
  const byDate = new Map<string, CalendarDay>(
    dates.map((date) => [date, { date, blocked: false }]),
  );
  for (const entry of entries) {
    const day = byDate.get(entry.date);
    if (!day) continue;
    if (entry.kind === "blocked") day.blocked = true;
    if (entry.kind === "price")
      day.priceOverrideCents = entry.nightlyPriceCents;
    if (entry.kind === "reservation" && occupyingStatuses.has(entry.status))
      day.reservation = {
        reservationId: entry.reservationId,
        status: entry.status,
      };
  }
  return dates.map((date) => byDate.get(date)!);
}

export function formatCalendarDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
