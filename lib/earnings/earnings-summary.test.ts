import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  monthWindow,
  summarizeEarnings,
  type EarningsReservation,
} from "./earnings-summary";

function stay(
  checkIn: string,
  nights: string[],
  overrides: Partial<EarningsReservation> = {},
): EarningsReservation {
  return {
    status: "confirmed",
    paymentStatus: "paid",
    checkIn,
    quote: {
      nightlyCharges: nights.map((date) => ({ date, amountCents: 10_000 })),
      cleaningFeeCents: 2_000,
      totalCents: nights.length * 11_000 + 2_000,
    },
    ...overrides,
  };
}

describe("month window", () => {
  test("spans a year boundary", () => {
    assert.deepEqual(monthWindow("2026-02-14", 3, 5), [
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });
});

describe("earnings summary", () => {
  const months = ["2026-10", "2026-11"];

  test("splits a stay's nights across months and books cleaning on arrival", () => {
    const [october, november] = summarizeEarnings(
      [stay("2026-10-30", ["2026-10-30", "2026-10-31", "2026-11-01"])],
      months,
      1,
    );
    assert.equal(october.bookedNights, 2);
    assert.equal(october.earnedCents, 22_000);
    assert.equal(november.bookedNights, 1);
    assert.equal(november.earnedCents, 10_000);
    assert.equal(october.availableNights, 31);
    assert.equal(november.occupancyRate, 1 / 30);
  });

  test("excludes unpaid or closed bookings from earnings and occupancy", () => {
    const [october] = summarizeEarnings(
      [
        stay("2026-10-01", ["2026-10-01"], {
          status: "pending",
          paymentStatus: "hold",
        }),
        stay("2026-10-02", ["2026-10-02"], {
          status: "expired",
          paymentStatus: "declined",
        }),
        stay("2026-10-03", ["2026-10-03"], {
          status: "cancelled",
          paymentStatus: "refunded",
        }),
      ],
      months,
      2,
    );
    assert.equal(october.bookedNights, 0);
    assert.equal(october.earnedCents, 0);
    assert.equal(october.refundedCents, 13_000);
    assert.equal(october.availableNights, 62);
  });

  test("reports zero occupancy with no listings", () => {
    const [october] = summarizeEarnings([], months, 0);
    assert.equal(october.occupancyRate, 0);
  });
});
