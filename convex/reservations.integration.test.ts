import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import {
  createIntegrationHarness,
  errorCode,
  eventually,
  stayDates,
  type IntegrationHarness,
} from "../lib/testing/integration-harness";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

describe("reservations against the test deployment", () => {
  let h: IntegrationHarness;
  let instantListingId: Id<"listings">;
  let requestListingId: Id<"listings">;

  before(async () => {
    h = await createIntegrationHarness();
    const host = await h.as("host");
    const requestHost = await h.as("requesthost");
    instantListingId = (await h.publishListing(host.client))._id;
    requestListingId = (
      await h.publishListing(requestHost.client, { bookingMode: "request" })
    )._id;
  });

  after(async () => {
    await h?.cleanup();
  });

  test("rejects unauthenticated and unrelated callers", async () => {
    const guest = await h.as("guest");
    const outsider = await h.as("outsider");
    const reservation = await h.book(
      guest.client,
      instantListingId,
      stayDates(30, 2),
    );

    assert.equal(
      await errorCode(h.admin.run(api.reservations.myReservations, {})),
      "UNAUTHENTICATED",
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.reservations.capturePayment, {
          reservationId: reservation._id,
          idempotencyKey: "steal",
        }),
      ),
      "FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.reservations.cancel, {
          reservationId: reservation._id,
          reason: "not mine",
        }),
      ),
      "FORBIDDEN",
    );
    const outsiderTrips = await outsider.client.run(
      api.reservations.myReservations,
      {},
    );
    assert.equal(
      outsiderTrips.some((trip) => trip._id === reservation._id),
      false,
    );
  });

  test("lets exactly one of several concurrent guests reserve the same nights", async () => {
    const dates = stayDates(40, 3);
    const guests = await Promise.all(
      ["c1", "c2", "c3", "c4", "c5"].map((role) => h.as(role)),
    );
    const quotes = await Promise.all(
      guests.map((guest) =>
        guest.client.run(api.reservations.quote, {
          listingId: instantListingId,
          ...dates,
          guests: 2,
        }),
      ),
    );
    const results = await Promise.allSettled(
      guests.map((guest, index) =>
        guest.client.run(api.reservations.createFromQuote, {
          quoteId: quotes[index].quoteId,
          idempotencyKey: `race-${index}`,
        }),
      ),
    );

    const winners = results.filter((result) => result.status === "fulfilled");
    assert.equal(winners.length, 1);
    for (const result of results) {
      if (result.status === "rejected")
        assert.equal(
          await errorCode(Promise.reject(result.reason)),
          "UNAVAILABLE",
        );
    }
    const winner = (
      winners[0] as PromiseFulfilledResult<{ _id: Id<"reservations"> }>
    ).value;
    assert.equal((await h.inspect(winner._id))?.reservedNights, 3);
  });

  test("allows adjacent stays and replays an idempotent create", async () => {
    const guest = await h.as("adjacent");
    const first = stayDates(50, 2);
    const second = {
      checkIn: first.checkOut,
      checkOut: stayDates(54, 0).checkIn,
    };
    const { quoteId } = await guest.client.run(api.reservations.quote, {
      listingId: instantListingId,
      ...first,
      guests: 1,
    });
    const created = await guest.client.run(api.reservations.createFromQuote, {
      quoteId,
      idempotencyKey: "adjacent-1",
    });
    const replay = await guest.client.run(api.reservations.createFromQuote, {
      quoteId,
      idempotencyKey: "adjacent-1",
    });
    assert.equal(replay._id, created._id);
    const next = await h.book(guest.client, instantListingId, second);
    assert.notEqual(next._id, created._id);
  });

  test("expires an unpaid instant hold and releases its nights", async () => {
    const guest = await h.as("expiry");
    const dates = stayDates(60, 2);
    const reservation = await h.book(guest.client, instantListingId, dates);
    const expiresAt = Date.now() - 1_000;
    await h.admin.run(internal.testing.shiftReservationTimes, {
      reservationId: reservation._id,
      paymentHoldExpiresAt: expiresAt,
    });
    assert.equal(
      await h.admin.run(internal.reservations.expirePaymentHold, {
        reservationId: reservation._id,
        expiresAt,
      }),
      true,
    );

    const state = await h.inspect(reservation._id);
    assert.equal(state?.reservation.status, "expired");
    assert.equal(state?.reservedNights, 0);
    const rebooked = await h.book(
      (await h.as("rebook")).client,
      instantListingId,
      dates,
    );
    assert.equal(rebooked.status, "pending");
  });

  test("expires a request the host never answered without holding inventory", async () => {
    const guest = await h.as("requester");
    const reservation = await h.book(
      guest.client,
      requestListingId,
      stayDates(30, 2),
    );
    assert.equal(reservation.paymentStatus, "not_required");
    assert.equal((await h.inspect(reservation._id))?.reservedNights, 0);
    const expiresAt = Date.now() - 1_000;
    await h.admin.run(internal.testing.shiftReservationTimes, {
      reservationId: reservation._id,
      requestExpiresAt: expiresAt,
    });
    assert.equal(
      await h.admin.run(internal.reservations.expireRequest, {
        reservationId: reservation._id,
        expiresAt,
      }),
      true,
    );
    assert.equal(
      (await h.inspect(reservation._id))?.reservation.status,
      "expired",
    );
  });

  test("refunds an eligible guest cancellation exactly once", async () => {
    const guest = await h.as("canceller");
    const reservation = await h.bookAndPay(
      guest.client,
      instantListingId,
      stayDates(70, 2),
    );
    const result = await guest.client.run(api.reservations.cancel, {
      reservationId: reservation._id,
      reason: "plans changed",
    });
    assert.equal(result.kind, "cancelled");
    assert.equal(
      await errorCode(
        guest.client.run(api.reservations.cancel, {
          reservationId: reservation._id,
          reason: "again",
        }),
      ),
      "INVALID_STATE",
    );

    const state = await eventually(
      () => h.inspect(reservation._id),
      (value) => value?.reservation.paymentStatus === "refunded",
    );
    const refunds = state!.paymentOperations.filter(
      (operation: { kind: string }) => operation.kind === "refund",
    );
    assert.equal(refunds.length, 1);
    assert.equal(state!.reservedNights, 0);
  });

  test("records a failed refund and settles it on support retry", async () => {
    const guest = await h.as("refundfail");
    const reservation = await h.bookAndPay(
      guest.client,
      instantListingId,
      stayDates(80, 2),
    );
    await h.admin.run(internal.reservations.setPaymentSimulationScenario, {
      reservationId: reservation._id,
      kind: "refund",
      outcome: "refund_failure",
      delayMs: 0,
    });
    await guest.client.run(api.reservations.cancel, {
      reservationId: reservation._id,
      reason: "testing refund failure",
    });
    const failed = await eventually(
      () => h.inspect(reservation._id),
      (value) => value?.reservation.paymentStatus === "refund_failed",
    );
    assert.ok(
      failed!.events.some(
        (event: { kind: string }) => event.kind === "refund_failed",
      ),
    );

    const refund = failed!.paymentOperations.find(
      (operation: { kind: string }) => operation.kind === "refund",
    );
    assert.ok(refund);
    assert.equal(
      await h.admin.run(internal.reservations.retryRefund, {
        paymentOperationId: refund._id,
        outcome: "success",
      }),
      true,
    );
    const settled = await eventually(
      () => h.inspect(reservation._id),
      (value) => value?.reservation.paymentStatus === "refunded",
    );
    const refunds = settled!.paymentOperations.filter(
      (operation: { kind: string }) => operation.kind === "refund",
    );
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].attempts, 2);
  });

  test("routes a late guest cancellation to audited support review", async () => {
    const guest = await h.as("late");
    const reservation = await h.bookAndPay(
      guest.client,
      instantListingId,
      stayDates(90, 2),
    );
    await h.admin.run(internal.testing.shiftReservationTimes, {
      reservationId: reservation._id,
      checkInAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const result = await guest.client.run(api.reservations.cancel, {
      reservationId: reservation._id,
      reason: "flight cancelled",
    });
    assert.equal(result.kind, "support_required");
    const state = await h.inspect(reservation._id);
    assert.equal(state?.reservation.status, "confirmed");
    assert.equal(state?.supportRequests.length, 1);
    assert.ok(
      state?.events.some(
        (event: { kind: string }) =>
          event.kind === "late_cancellation_requested",
      ),
    );
  });

  test("expires the reservation and frees nights when the simulated charge declines", async () => {
    const guest = await h.as("declined");
    const reservation = await h.book(
      guest.client,
      instantListingId,
      stayDates(100, 2),
    );
    await h.admin.run(internal.reservations.setPaymentSimulationScenario, {
      reservationId: reservation._id,
      kind: "charge",
      outcome: "decline",
      delayMs: 0,
    });
    await guest.client.run(api.reservations.capturePayment, {
      reservationId: reservation._id,
      idempotencyKey: "decline-1",
    });
    const state = await eventually(
      () => h.inspect(reservation._id),
      (value) => value?.reservation.paymentStatus === "declined",
    );
    assert.equal(state?.reservation.status, "expired");
    assert.equal(state?.reservedNights, 0);
  });
});
