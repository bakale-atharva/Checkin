import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { previewGuestCancellation, tripGroup } from "./cancellation-preview";

const checkInAt = "2026-11-10T15:00:00.000+00:00";
const base = {
  status: "confirmed" as const,
  paymentStatus: "paid" as const,
  checkInAt,
  totalCents: 58_100,
};

describe("guest cancellation preview", () => {
  test("refunds a paid stay in full up to exactly 24 hours before check-in", () => {
    assert.deepEqual(
      previewGuestCancellation(base, "2026-11-09T15:00:00.000Z"),
      { kind: "full_refund", refundCents: 58_100 },
    );
  });

  test("routes to support one millisecond after the cutoff", () => {
    assert.deepEqual(
      previewGuestCancellation(base, "2026-11-09T15:00:00.001Z"),
      { kind: "support_required", paidCents: 58_100 },
    );
  });

  test("reports no charge for an unpaid pending booking", () => {
    assert.deepEqual(
      previewGuestCancellation(
        { ...base, status: "pending", paymentStatus: "hold" },
        "2026-11-01T00:00:00.000Z",
      ),
      { kind: "no_charge" },
    );
  });

  test("refuses finished or already-closed reservations", () => {
    for (const status of [
      "completed",
      "cancelled",
      "declined",
      "expired",
    ] as const)
      assert.deepEqual(
        previewGuestCancellation({ ...base, status }, "2026-11-01T00:00:00Z"),
        { kind: "not_cancellable" },
      );
  });
});

describe("trip grouping", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  const checkOutAt = "2026-11-12T11:00:00.000+00:00";

  test("closed reservations go to cancelled", () => {
    for (const status of ["cancelled", "declined", "expired"] as const)
      assert.equal(tripGroup({ status, checkOutAt }, now), "cancelled");
  });

  test("a confirmed stay whose checkout passed is past", () => {
    assert.equal(tripGroup({ status: "confirmed", checkOutAt }, now), "past");
    assert.equal(
      tripGroup(
        { status: "confirmed", checkOutAt },
        Date.parse("2026-11-12T10:59:59Z"),
      ),
      "upcoming",
    );
  });

  test("pending requests are upcoming", () => {
    assert.equal(
      tripGroup(
        { status: "pending", checkOutAt: "2026-12-01T11:00:00.000+00:00" },
        now,
      ),
      "upcoming",
    );
  });
});
