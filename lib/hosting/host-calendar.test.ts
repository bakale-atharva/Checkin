import assert from "node:assert/strict";
import test from "node:test";

import { addDays, buildCalendarDays, dateRange } from "./host-calendar";

test("adds days across month and leap-year boundaries", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2028-02-29", 1), "2028-03-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("builds a consecutive range", () => {
  assert.deepEqual(dateRange("2026-10-30", 3), [
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ]);
});

test("folds reservations, blocks, and price overrides into days", () => {
  const days = buildCalendarDays(dateRange("2026-11-01", 4), [
    {
      kind: "reservation",
      listingId: "l1",
      date: "2026-11-01",
      reservationId: "r1",
      status: "confirmed",
    },
    {
      kind: "reservation",
      listingId: "l1",
      date: "2026-11-02",
      reservationId: "r2",
      status: "cancelled",
    },
    { kind: "blocked", listingId: "l1", date: "2026-11-03" },
    {
      kind: "price",
      listingId: "l1",
      date: "2026-11-03",
      nightlyPriceCents: 25_000,
    },
    { kind: "blocked", listingId: "l1", date: "2026-12-25" },
  ]);
  assert.equal(days.length, 4);
  assert.deepEqual(days[0]?.reservation, {
    reservationId: "r1",
    status: "confirmed",
  });
  assert.equal(days[1]?.reservation, undefined);
  assert.equal(days[2]?.blocked, true);
  assert.equal(days[2]?.priceOverrideCents, 25_000);
  assert.equal(days[3]?.blocked, false);
});
