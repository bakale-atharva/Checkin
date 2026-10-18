import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import {
  createIntegrationHarness,
  eventually,
  stayDates,
  type IntegrationHarness,
} from "../lib/testing/integration-harness";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const DAY = 24 * 60 * 60 * 1000;

describe("background reconciliation against the test deployment", () => {
  let h: IntegrationHarness;
  let listingId: Id<"listings">;

  before(async () => {
    h = await createIntegrationHarness();
    listingId = (await h.publishListing((await h.as("host")).client))._id;
  });

  after(async () => {
    await h?.cleanup();
  });

  test("repairs a payment hold whose scheduled expiry was missed", async () => {
    const guest = await h.as("missedhold");
    const reservation = await h.book(guest.client, listingId, stayDates(30, 2));
    await h.admin.run(internal.testing.shiftReservationTimes, {
      reservationId: reservation._id,
      paymentHoldExpiresAt: Date.now() - 1_000,
    });

    const result = await h.admin.run(
      internal.operations.reconcileBackgroundOperations,
      {},
    );
    assert.ok(result.repairedTransitions >= 1);
    const state = await h.inspect(reservation._id);
    assert.equal(state?.reservation.status, "expired");
    assert.equal(state?.reservedNights, 0);
  });

  test("completes a finished stay whose completion job was missed", async () => {
    const guest = await h.as("missedcompletion");
    const reservation = await h.bookAndPay(
      guest.client,
      listingId,
      stayDates(40, 2),
    );
    const checkOutAt = Date.now() - DAY;
    await h.admin.run(internal.testing.shiftReservationTimes, {
      reservationId: reservation._id,
      checkIn: new Date(checkOutAt - 2 * DAY).toISOString().slice(0, 10),
      checkOut: new Date(checkOutAt).toISOString().slice(0, 10),
      checkInAt: new Date(checkOutAt - 2 * DAY).toISOString(),
      checkOutAt: new Date(checkOutAt).toISOString(),
    });

    await h.admin.run(internal.operations.reconcileBackgroundOperations, {});
    const state = await h.inspect(reservation._id);
    assert.equal(state?.reservation.status, "completed");
    assert.equal(state?.payouts.length, 1);
  });

  test("flags a stalled refund for support, then closes the incident after a retry", async () => {
    const guest = await h.as("stalledrefund");
    const reservation = await h.bookAndPay(
      guest.client,
      listingId,
      stayDates(50, 2),
    );
    await h.admin.run(internal.reservations.setPaymentSimulationScenario, {
      reservationId: reservation._id,
      kind: "refund",
      outcome: "delay",
      delayMs: 0,
    });
    await guest.client.run(api.reservations.cancel, {
      reservationId: reservation._id,
      reason: "testing a stalled refund",
    });
    assert.equal(
      await h.admin.run(internal.testing.backdatePaymentOperations, {
        reservationId: reservation._id,
        updatedAt: Date.now() - 2 * DAY,
      }),
      1,
    );

    const result = await h.admin.run(
      internal.operations.reconcileBackgroundOperations,
      {},
    );
    assert.ok(result.flaggedPaymentOperations >= 1);
    const flagged = await h.inspect(reservation._id);
    assert.equal(flagged?.reservation.paymentStatus, "refund_failed");
    const event = flagged?.events.find(
      (candidate: { kind: string }) => candidate.kind === "refund_stalled",
    );
    assert.ok(event);

    const refund = flagged?.paymentOperations.find(
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
    await eventually(
      () => h.inspect(reservation._id),
      (state) => state?.reservation.paymentStatus === "refunded",
    );

    assert.equal(
      await h.admin.run(internal.operations.resolveEvent, {
        eventId: event._id,
        resolvedBy: "integration-suite",
        resolutionNote: "Refund retried successfully.",
      }),
      true,
    );
    const open = await h.admin.run(internal.operations.listOpenEvents, {
      limit: 200,
    });
    assert.equal(
      open.some((candidate) => candidate._id === event._id),
      false,
    );

    // Reconciliation is idempotent: a second pass raises no new incident for the same operation.
    await h.admin.run(internal.operations.reconcileBackgroundOperations, {});
    const after = await h.inspect(reservation._id);
    assert.equal(
      after?.events.filter(
        (candidate: { kind: string }) => candidate.kind === "refund_stalled",
      ).length,
      1,
    );
  });
});
