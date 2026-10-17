type Environment = Record<string, string | undefined>;

export const TEST_DEPLOYMENT_MARKER = "true";
/** Issuer for synthetic identities; their tokenIdentifier is `${issuer}|itest_<runId>_<role>`. */
export const TEST_IDENTITY_ISSUER = "https://checkin-integration.test";

export type IntegrationTarget = {
  url: string;
  deployKey: string;
  deploymentName: string;
};

/**
 * Resolves the dedicated Convex integration-test deployment. Fails before any
 * network call unless the explicit marker, URL, and a non-production deploy key
 * for that same deployment are configured. Never falls back to other targets.
 */
export function getIntegrationTarget(
  environment: Environment,
): IntegrationTarget {
  if (environment.CHECKIN_CONVEX_TEST_DEPLOYMENT !== TEST_DEPLOYMENT_MARKER) {
    throw new Error(
      'CHECKIN_CONVEX_TEST_DEPLOYMENT must be "true" (set in .env.test.local) before integration tests can run.',
    );
  }

  const url = environment.CONVEX_TEST_DEPLOYMENT_URL;
  if (!url) {
    throw new Error(
      "CONVEX_TEST_DEPLOYMENT_URL must name a dedicated Convex test deployment.",
    );
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("CONVEX_TEST_DEPLOYMENT_URL must be a valid URL.");
  }
  const deploymentName = host.split(".")[0];

  const deployKey = environment.CONVEX_DEPLOY_KEY;
  if (!deployKey) {
    throw new Error(
      "CONVEX_DEPLOY_KEY for the test deployment must be set in .env.test.local.",
    );
  }
  const [keyType, rest = ""] = deployKey.split(":", 2);
  if (keyType !== "dev" && keyType !== "preview") {
    throw new Error("Integration tests refuse production deploy keys.");
  }
  if (!rest.startsWith(`${deploymentName}|`)) {
    throw new Error(
      "CONVEX_DEPLOY_KEY does not belong to CONVEX_TEST_DEPLOYMENT_URL.",
    );
  }

  for (const appUrl of [
    environment.NEXT_PUBLIC_CONVEX_URL,
    environment.CONVEX_URL,
  ]) {
    if (appUrl && appUrl.replace(/\/$/, "") === url.replace(/\/$/, "")) {
      throw new Error(
        "The integration-test deployment must differ from the application deployment.",
      );
    }
  }

  return { url, deployKey, deploymentName };
}
