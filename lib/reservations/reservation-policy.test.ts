import assert from "node:assert/strict";
import test from "node:test";

import {
  ReservationPolicyError,
  createReservationQuote,
  datesOverlap,
  isCancellationRefundEligible,
  reservationForBookingMode,
  transitionReservation,
} from "./reservation-policy";

test("creates an immutable nightly quote using exclusive checkout", () => {
  const quote = createReservationQuote({
    checkIn: "2026-11-01",
    checkOut: "2026-11-04",
    timezone: "America/New_York",
    nightlyPriceCents: 10_000,
    cleaningFeeCents: 3_000,
    nightlyPriceOverrides: { "2026-11-02": 12_000 },
  });

  assert.deepEqual(quote.nightlyCharges, [
    { date: "2026-11-01", amountCents: 10_000 },
    { date: "2026-11-02", amountCents: 12_000 },
    { date: "2026-11-03", amountCents: 10_000 },
  ]);
  assert.equal(quote.accommodationCents, 32_000);
  assert.equal(quote.serviceFeeCents, 3_200);
  assert.equal(quote.taxCents, 0);
  assert.equal(quote.totalCents, 38_200);
  assert.equal(quote.hostProceedsCents, 35_000);
  assert.equal(quote.checkInAt, "2026-11-01T15:00:00.000-05:00");
  assert.equal(quote.checkOutAt, "2026-11-04T11:00:00.000-05:00");
  assert.equal(quote.cancellationDeadline, "2026-10-31T20:00:00.000Z");
});

test("keeps property-local check-in timestamps correct through daylight-saving changes", () => {
  const quote = createReservationQuote({
    checkIn: "2027-03-14",
    checkOut: "2027-03-15",
    timezone: "America/New_York",
    nightlyPriceCents: 10_000,
    cleaningFeeCents: 0,
    nightlyPriceOverrides: {},
  });

  assert.equal(quote.cancellationDeadline, "2027-03-13T19:00:00.000Z");
  assert.equal(quote.checkInAt, "2027-03-14T15:00:00.000-04:00");
  assert.equal(quote.checkOutAt, "2027-03-15T11:00:00.000-04:00");
});

test("rejects nonexistent property-local times during daylight-saving gaps", () => {
  assert.throws(
    () => createReservationQuote({
      checkIn: "2027-03-14",
      checkOut: "2027-03-15",
      timezone: "America/New_York",
      checkInTime: "02:30",
      nightlyPriceCents: 10_000,
      cleaningFeeCents: 0,
      nightlyPriceOverrides: {},
    }),
    ReservationPolicyError,
  );
});

test("rejects invalid stays and invalid property timezones", () => {
  assert.throws(
    () =>
      createReservationQuote({
        checkIn: "2026-11-04",
        checkOut: "2026-11-04",
        timezone: "America/New_York",
        nightlyPriceCents: 10_000,
        cleaningFeeCents: 0,
        nightlyPriceOverrides: {},
      }),
    ReservationPolicyError,
  );
  assert.throws(
    () =>
      createReservationQuote({
        checkIn: "2026-11-01",
        checkOut: "2026-11-02",
        timezone: "Not/A_Timezone",
        nightlyPriceCents: 10_000,
        cleaningFeeCents: 0,
        nightlyPriceOverrides: {},
      }),
    ReservationPolicyError,
  );
});

test("permits adjacent stays but rejects overlapping stays", () => {
  assert.equal(datesOverlap("2026-11-01", "2026-11-04", "2026-11-04", "2026-11-06"), false);
  assert.equal(datesOverlap("2026-11-01", "2026-11-04", "2026-11-03", "2026-11-06"), true);
});

test("allows a full guest refund until exactly 24 local hours before check-in", () => {
  assert.equal(
    isCancellationRefundEligible("2026-11-01T15:00:00.000-04:00", "2026-10-31T15:00:00.000-04:00"),
    true,
  );
  assert.equal(
    isCancellationRefundEligible("2026-11-01T15:00:00.000-04:00", "2026-10-31T15:00:00.001-04:00"),
    false,
  );
});

test("starts instant stays in a payment hold and requests without blocked inventory", () => {
  assert.deepEqual(reservationForBookingMode("instant"), {
    reservationStatus: "pending",
    inventoryReserved: true,
    paymentStatus: "hold",
  });
  assert.deepEqual(reservationForBookingMode("request"), {
    reservationStatus: "pending",
    inventoryReserved: false,
    paymentStatus: "not_required",
  });
});

test("allows only authoritative reservation lifecycle transitions", () => {
  assert.equal(transitionReservation("pending", "confirmed"), "confirmed");
  assert.equal(transitionReservation("pending", "declined"), "declined");
  assert.equal(transitionReservation("confirmed", "completed"), "completed");
  assert.throws(
    () => transitionReservation("completed", "cancelled"),
    ReservationPolicyError,
  );
});
