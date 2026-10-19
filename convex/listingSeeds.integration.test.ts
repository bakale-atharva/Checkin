import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import {
  createIntegrationHarness,
  type IntegrationHarness,
} from "../lib/testing/integration-harness";
import { api, internal } from "./_generated/api";

describe("demo seed against the test deployment", () => {
  let h: IntegrationHarness;
  let seedKey: string;

  before(async () => {
    h = await createIntegrationHarness();
    seedKey = `itest_${h.runId}`;
  });

  after(async () => {
    // Remove the run's seed even if an assertion failed midway.
    if (h) await h.admin.run(internal.listingSeeds.resetDemo, { seedKey });
    await h?.cleanup();
  });

  test("seeds browsable listings once and resets only its own data", async () => {
    const seeded = await h.admin.run(internal.listingSeeds.seedDemo, {
      seedKey,
    });
    assert.equal(seeded.skipped, false);
    assert.equal(seeded.listings, 60);
    assert.ok(seeded.reviews > 0);

    const again = await h.admin.run(internal.listingSeeds.seedDemo, {
      seedKey,
    });
    assert.equal(again.skipped, true);

    const guest = await h.as("seedbrowser");
    const snapshot = await guest.client.run(api.search.createSnapshot, {
      destination: "Reykjavik",
      category: "Cabins",
    });
    assert.ok(snapshot.total > 0);
    const page = await guest.client.run(api.search.page, {
      snapshotId: snapshot.snapshotId,
      offset: 0,
    });
    const cabin = page.page[0];
    assert.match(
      cabin.coverPhotoUrl ?? "",
      /^https:\/\/images\.unsplash\.com\/photo-/,
    );
    assert.ok(page.page.some((listing) => listing.publishedRating > 0));

    const detail = await guest.client.run(api.listings.getPublished, {
      listingId: cabin.listingId,
    });
    assert.ok(detail && detail.photos.length >= 2);
    assert.ok(
      detail.photos.every((photo) =>
        photo.url?.startsWith("https://images.unsplash.com/"),
      ),
    );

    const reset = await h.admin.run(internal.listingSeeds.resetDemo, {
      seedKey,
    });
    assert.ok(reset.deleted > 60);
    assert.equal(
      await guest.client.run(api.listings.getPublished, {
        listingId: cabin.listingId,
      }),
      null,
    );
    assert.equal(
      (await h.admin.run(internal.listingSeeds.resetDemo, { seedKey })).deleted,
      0,
    );
  });

  test("rejects malformed seed keys", async () => {
    await assert.rejects(
      h.admin.run(internal.listingSeeds.seedDemo, { seedKey: "Not OK!" }),
      /INVALID_SEED_INPUT|lowercase/,
    );
  });
});
