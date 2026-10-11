type Environment = Record<string, string | undefined>;

const TEST_DEPLOYMENT_MARKER = "true";

export function getIntegrationTestTarget(environment: Environment): string {
  if (environment.CHECKIN_CONVEX_TEST_DEPLOYMENT !== TEST_DEPLOYMENT_MARKER) {
    throw new Error(
      'CHECKIN_CONVEX_TEST_DEPLOYMENT must be set to "true" before integration tests can run.',
    );
  }

  const target = environment.CONVEX_TEST_DEPLOYMENT_URL;

  if (!target) {
    throw new Error(
      "CONVEX_TEST_DEPLOYMENT_URL must be set to a dedicated Convex test deployment.",
    );
  }

  return target;
}
