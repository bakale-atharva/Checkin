import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Optional signed-in journeys read E2E_CLERK_USER_EMAIL from the gitignored
// test env file. Clerk keys come from .env.local via clerkSetup().
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Browser journeys, co-located with the routes they cover as `*.e2e.ts`.
 * They run against the app at E2E_BASE_URL (the local dev server by default),
 * which talks to that server's Convex deployment.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  testIgnore: ["**/node_modules/**", "**/.next/**"],
  outputDir: "test-results/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./lib/testing/e2e-global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm run frontend",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
