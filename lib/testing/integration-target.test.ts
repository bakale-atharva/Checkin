import assert from "node:assert/strict";
import test from "node:test";

import { getIntegrationTarget } from "./integration-target";

const valid = {
  CHECKIN_CONVEX_TEST_DEPLOYMENT: "true",
  CONVEX_TEST_DEPLOYMENT_URL: "https://glorious-shrimp-629.convex.cloud",
  CONVEX_DEPLOY_KEY: "dev:glorious-shrimp-629|secret",
};

test("resolves a fully configured dedicated test target", () => {
  assert.deepEqual(getIntegrationTarget(valid), {
    url: valid.CONVEX_TEST_DEPLOYMENT_URL,
    deployKey: valid.CONVEX_DEPLOY_KEY,
    deploymentName: "glorious-shrimp-629",
  });
});

test("fails early without the explicit test marker", () => {
  assert.throws(() => getIntegrationTarget({ ...valid, CHECKIN_CONVEX_TEST_DEPLOYMENT: undefined }), /CHECKIN_CONVEX_TEST_DEPLOYMENT/);
  assert.throws(() => getIntegrationTarget({ ...valid, CHECKIN_CONVEX_TEST_DEPLOYMENT: "1" }), /CHECKIN_CONVEX_TEST_DEPLOYMENT/);
});

test("fails early without a test URL or deploy key", () => {
  assert.throws(() => getIntegrationTarget({ ...valid, CONVEX_TEST_DEPLOYMENT_URL: undefined }), /CONVEX_TEST_DEPLOYMENT_URL/);
  assert.throws(() => getIntegrationTarget({ ...valid, CONVEX_DEPLOY_KEY: undefined }), /CONVEX_DEPLOY_KEY/);
});

test("refuses production deploy keys", () => {
  assert.throws(() => getIntegrationTarget({ ...valid, CONVEX_DEPLOY_KEY: "prod:glorious-shrimp-629|secret" }), /production/);
});

test("refuses a deploy key for a different deployment", () => {
  assert.throws(() => getIntegrationTarget({ ...valid, CONVEX_DEPLOY_KEY: "dev:zealous-nightingale-719|secret" }), /does not belong/);
});

test("refuses to target the application deployment", () => {
  assert.throws(
    () => getIntegrationTarget({ ...valid, NEXT_PUBLIC_CONVEX_URL: "https://glorious-shrimp-629.convex.cloud/" }),
    /must differ/,
  );
});
