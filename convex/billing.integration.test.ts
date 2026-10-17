import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import {
  createIntegrationHarness,
  errorCode,
  stayDates,
  type IntegrationHarness,
} from "../lib/testing/integration-harness";
import { api, internal } from "./_generated/api";

describe("billing webhooks and publication limits against the test deployment", () => {
  let h: IntegrationHarness;

  before(async () => {
    h = await createIntegrationHarness();
  });

  after(async () => {
    await h?.cleanup();
  });

  function subscriptionEvent(
    clerkUserId: string,
    eventSuffix: string,
    fields: { status: string; occurredAt: number; planSlug?: string },
  ) {
    return {
      clerkEventId: `itest_${h.runId}_${eventSuffix}`,
      clerkSubscriptionId: `itest_${h.runId}_sub_${clerkUserId.slice(-8)}`,
      clerkUserId,
      planSlug: fields.planSlug ?? "host_pro",
      status: fields.status,
      effectiveUntil: null,
      occurredAt: fields.occurredAt,
      isSubscriptionItem: false,
    };
  }

  test("lets only one of two concurrent publishes through on the free plan", async () => {
    const host = await h.as("racer");
    const [first, second] = await Promise.all([
      h.prepareListing(host.client),
      h.prepareListing(host.client),
    ]);
    const results = await Promise.allSettled([
      host.client.run(api.listings.setStatus, {
        listingId: first,
        status: "published",
      }),
      host.client.run(api.listings.setStatus, {
        listingId: second,
        status: "published",
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejected = results.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    assert.equal(
      await errorCode(Promise.reject(rejected.reason)),
      "INVALID_LISTING_STATE",
    );
  });

  test("deduplicates replays, ignores stale events, and suspends excess listings on downgrade", async () => {
    const host = await h.as("prohost");
    const guest = await h.as("proguest");
    const t0 = Date.now();

    const upgrade = subscriptionEvent(host.clerkUserId, "upgrade", {
      status: "active",
      occurredAt: t0,
    });
    assert.deepEqual(
      await h.admin.run(internal.billing.recordSubscriptionWebhook, upgrade),
      { processed: true },
    );
    assert.deepEqual(
      await h.admin.run(internal.billing.recordSubscriptionWebhook, upgrade),
      { processed: false },
    );

    const oldest = await h.publishListing(host.client, {
      title: "Oldest listing",
    });
    const newer = await h.publishListing(host.client, {
      title: "Newer listing",
    });
    const existingStay = await h.bookAndPay(
      guest.client,
      newer._id,
      stayDates(30, 2),
    );

    const stale = subscriptionEvent(host.clerkUserId, "stale", {
      status: "past_due",
      occurredAt: t0 - 60_000,
    });
    assert.deepEqual(
      await h.admin.run(internal.billing.recordSubscriptionWebhook, stale),
      { processed: false },
    );
    assert.equal(
      (await host.client.run(api.billing.currentHostSubscription, {}))?.status,
      "active",
    );

    const downgrade = subscriptionEvent(host.clerkUserId, "downgrade", {
      status: "past_due",
      occurredAt: t0 + 60_000,
    });
    assert.deepEqual(
      await h.admin.run(internal.billing.recordSubscriptionWebhook, downgrade),
      { processed: true },
    );

    const listings = await host.client.run(api.listings.myListings, {});
    assert.equal(
      listings.find((listing) => listing._id === oldest._id)?.bookingSuspended,
      false,
    );
    assert.equal(
      listings.find((listing) => listing._id === newer._id)?.bookingSuspended,
      true,
    );
    assert.equal(
      await errorCode(
        guest.client.run(api.reservations.quote, {
          listingId: newer._id,
          ...stayDates(60, 2),
          guests: 1,
        }),
      ),
      "LISTING_UNAVAILABLE",
    );
    assert.equal(
      (await h.inspect(existingStay._id))?.reservation.status,
      "confirmed",
    );
  });

  test("rejects webhook ingestion without the shared secret", async () => {
    const host = await h.as("secretless");
    const event = subscriptionEvent(host.clerkUserId, "forged", {
      status: "active",
      occurredAt: Date.now(),
    });
    assert.equal(
      await errorCode(
        host.client.run(api.billing.ingestSubscriptionWebhook, {
          ...event,
          ingestSecret: "guess",
        }),
      ),
      "FORBIDDEN",
    );
    assert.equal(
      await host.client.run(api.billing.currentHostSubscription, {}),
      null,
    );
  });
});
