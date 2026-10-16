import assert from "node:assert/strict";
import test from "node:test";

import {
  publicationAllowance,
  selectFreeListing,
} from "./host-plan-policy";

test("retains the Host Pro publication allowance through the effective end", () => {
  assert.equal(
    publicationAllowance({
      planSlug: "host_pro",
      status: "canceled",
      effectiveUntil: 1_000,
    }, 999),
    10,
  );
  assert.equal(
    publicationAllowance({
      planSlug: "host_pro",
      status: "canceled",
      effectiveUntil: 1_000,
    }, 1_000),
    1,
  );
});

test("does not retain Host Pro access after an ended subscription", () => {
  assert.equal(
    publicationAllowance({
      planSlug: "host_pro",
      status: "ended",
      effectiveUntil: null,
    }, 1_000),
    1,
  );
});

test("uses the selected published listing when a host downgrades", () => {
  assert.equal(
    selectFreeListing([
      { id: "newer", publishedAt: 200 },
      { id: "selected", publishedAt: 300 },
    ], "selected"),
    "selected",
  );
});

test("defaults a downgrade to the oldest published listing", () => {
  assert.equal(
    selectFreeListing([
      { id: "newer", publishedAt: 200 },
      { id: "older", publishedAt: 100 },
    ], null),
    "older",
  );
});
