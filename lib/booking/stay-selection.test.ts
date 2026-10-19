import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addDays,
  canSelectDate,
  estimateStay,
  monthGrid,
  nextStaySelection,
  nightsBetween,
  parseStayParams,
  stayHasUnavailableNight,
  todayIn,
} from "./stay-selection";

const none = new Set<string>();

describe("calendar grid", () => {
  test("pads a month to whole Sunday-first weeks", () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = monthGrid(2026, 9);
    assert.equal(weeks.length, 5);
    assert.deepEqual(weeks[0].slice(0, 5), [
      null,
      null,
      null,
      null,
      "2026-10-01",
    ]);
    assert.equal(weeks.flat().filter(Boolean).length, 31);
    assert.ok(weeks.every((week) => week.length === 7));
  });

  test("handles leap-year February", () => {
    assert.equal(monthGrid(2028, 1).flat().filter(Boolean).length, 29);
  });
});

describe("date helpers", () => {
  test("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(nightsBetween("2026-03-07", "2026-03-10"), 3);
  });

  test("reads today in the property's timezone", () => {
    const instant = Date.parse("2026-10-20T02:00:00Z");
    assert.equal(todayIn("UTC", instant), "2026-10-20");
    assert.equal(todayIn("America/Los_Angeles", instant), "2026-10-19");
  });
});

describe("stay selection", () => {
  const booked = new Set(["2026-11-05", "2026-11-06"]);

  test("treats checkout as exclusive when checking nights", () => {
    assert.equal(
      stayHasUnavailableNight("2026-11-01", "2026-11-05", booked),
      false,
    );
    assert.equal(
      stayHasUnavailableNight("2026-11-01", "2026-11-06", booked),
      true,
    );
  });

  test("starts, completes, and restarts a stay", () => {
    let selection = nextStaySelection({}, "2026-11-01", booked);
    assert.deepEqual(selection, { checkIn: "2026-11-01" });
    selection = nextStaySelection(selection, "2026-11-05", booked);
    assert.deepEqual(selection, {
      checkIn: "2026-11-01",
      checkOut: "2026-11-05",
    });
    selection = nextStaySelection(selection, "2026-11-10", booked);
    assert.deepEqual(selection, { checkIn: "2026-11-10" });
  });

  test("restarts instead of spanning a booked night", () => {
    const selection = nextStaySelection(
      { checkIn: "2026-11-01" },
      "2026-11-08",
      booked,
    );
    assert.deepEqual(selection, { checkIn: "2026-11-08" });
  });

  test("clicking a booked day as a new check-in clears the selection", () => {
    assert.deepEqual(nextStaySelection({}, "2026-11-05", booked), {});
  });

  test("lets a booked day be the checkout but not a check-in", () => {
    const today = "2026-10-19";
    assert.equal(canSelectDate("2026-11-05", {}, booked, today), false);
    assert.equal(
      canSelectDate("2026-11-05", { checkIn: "2026-11-02" }, booked, today),
      true,
    );
    assert.equal(
      canSelectDate("2026-11-07", { checkIn: "2026-11-02" }, booked, today),
      false,
    );
  });

  test("rejects past days and stays over 28 nights", () => {
    const today = "2026-10-19";
    assert.equal(canSelectDate("2026-10-18", {}, none, today), false);
    assert.equal(
      canSelectDate("2026-11-30", { checkIn: "2026-11-01" }, none, today),
      false,
    );
    assert.equal(
      canSelectDate("2026-11-29", { checkIn: "2026-11-01" }, none, today),
      true,
    );
  });
});

describe("URL stay params", () => {
  const params = (query: string) => new URLSearchParams(query);

  test("keeps valid dates and guests", () => {
    assert.deepEqual(
      parseStayParams(
        params("checkIn=2026-11-01&checkOut=2026-11-04&guests=3"),
      ),
      { checkIn: "2026-11-01", checkOut: "2026-11-04", guests: 3 },
    );
  });

  test("drops reversed, over-long, or malformed dates", () => {
    for (const query of [
      "checkIn=2026-11-04&checkOut=2026-11-01",
      "checkIn=2026-11-01&checkOut=2026-12-01",
      "checkIn=nope&checkOut=2026-11-02",
    ])
      assert.deepEqual(parseStayParams(params(query)), { guests: 1 });
  });

  test("keeps a lone check-in while a stay is being picked", () => {
    assert.deepEqual(parseStayParams(params("checkIn=2026-11-01")), {
      checkIn: "2026-11-01",
      guests: 1,
    });
  });

  test("defaults guests to one", () => {
    assert.equal(parseStayParams(params("guests=-2")).guests, 1);
  });
});

describe("price estimate", () => {
  const base = {
    timezone: "Europe/Lisbon",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    nightlyPriceCents: 10_000,
    cleaningFeeCents: 5_000,
  };

  test("matches the server quote rules, including overrides", () => {
    const quote = estimateStay({
      ...base,
      checkIn: "2026-11-01",
      checkOut: "2026-11-03",
      nightlyPriceOverrides: { "2026-11-02": 15_000 },
    });
    assert.ok(quote);
    assert.equal(quote.accommodationCents, 25_000);
    assert.equal(quote.serviceFeeCents, 2_500);
    assert.equal(quote.totalCents, 32_500);
  });

  test("returns null for an invalid stay", () => {
    assert.equal(
      estimateStay({
        ...base,
        checkIn: "2026-11-03",
        checkOut: "2026-11-01",
        nightlyPriceOverrides: {},
      }),
      null,
    );
  });
});
