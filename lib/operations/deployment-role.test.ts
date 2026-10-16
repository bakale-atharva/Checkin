import assert from "node:assert/strict";
import test from "node:test";

import {
  allowsFixtureManagement,
  allowsSimulatorControls,
  parseDeploymentRole,
} from "./deployment-role";

test("treats unset or unknown roles as standard deployments", () => {
  assert.equal(parseDeploymentRole(undefined), "standard");
  assert.equal(parseDeploymentRole("production"), "standard");
  assert.equal(parseDeploymentRole("TEST"), "standard");
});

test("allows simulator controls only on test and demo deployments", () => {
  assert.equal(allowsSimulatorControls(parseDeploymentRole("test")), true);
  assert.equal(allowsSimulatorControls(parseDeploymentRole("demo")), true);
  assert.equal(allowsSimulatorControls(parseDeploymentRole(undefined)), false);
});

test("allows fixture management only on dedicated test deployments", () => {
  assert.equal(allowsFixtureManagement(parseDeploymentRole("test")), true);
  assert.equal(allowsFixtureManagement(parseDeploymentRole("demo")), false);
  assert.equal(allowsFixtureManagement(parseDeploymentRole(undefined)), false);
});
