import assert from "node:assert/strict";
import test from "node:test";

import { getIntegrationTestTarget } from "../scripts/integration-target";

test("rejects integration runs without the explicit dedicated-test marker", () => {
  assert.throws(
    () =>
      getIntegrationTestTarget({
        CONVEX_TEST_DEPLOYMENT_URL: "https://steady-otter-123.convex.cloud",
      }),
    /CHECKIN_CONVEX_TEST_DEPLOYMENT must be set to "true"/,
  );
});

test("rejects integration runs without a dedicated Convex URL", () => {
  assert.throws(
    () =>
      getIntegrationTestTarget({
        CHECKIN_CONVEX_TEST_DEPLOYMENT: "true",
      }),
    /CONVEX_TEST_DEPLOYMENT_URL must be set/,
  );
});

test("returns the explicitly configured dedicated test target", () => {
  assert.equal(
    getIntegrationTestTarget({
      CHECKIN_CONVEX_TEST_DEPLOYMENT: "true",
      CONVEX_TEST_DEPLOYMENT_URL: "https://steady-otter-123.convex.cloud",
    }),
    "https://steady-otter-123.convex.cloud",
  );
});
