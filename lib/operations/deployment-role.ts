export type DeploymentRole = "test" | "demo" | "standard";

/** Unset or unrecognised values are treated as a standard (production-safe) deployment. */
export function parseDeploymentRole(value: string | undefined): DeploymentRole {
  return value === "test" || value === "demo" ? value : "standard";
}

/** Payment-outcome simulators and seed data: test or demo deployments only. */
export function allowsSimulatorControls(role: DeploymentRole) {
  return role === "test" || role === "demo";
}

/** Destructive fixture creation and cleanup: dedicated test deployments only. */
export function allowsFixtureManagement(role: DeploymentRole) {
  return role === "test";
}
