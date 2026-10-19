import AxeBuilder from "@axe-core/playwright";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

/** WCAG 2.2 AA, which is what Checkin commits to. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Fails on serious or critical axe violations. Third-party map canvases are
 * excluded: their controls are Mapbox's, and every map has a text fallback.
 */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude(".mapboxgl-map")
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.slice(0, 3).map((node) => node.target),
    })),
  ).toEqual([]);
}

/** The page never scrolls sideways (narrow phones and 200% zoom). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Waits for the first page of discovery results and returns listing links. */
export async function listingLinks(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 2, name: /\d+ stays?/ }),
  ).toBeVisible();
  return page.locator('a[href^="/listings/"]');
}

/** A local calendar date `days` from today, as YYYY-MM-DD. */
export function dateFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}

/**
 * Signs in as the dedicated e2e user (a Clerk development-instance test
 * account). Skips the calling test when none is configured.
 */
export async function signInTestUser(page: Page) {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL;
  test.skip(
    !emailAddress,
    "Set E2E_CLERK_USER_EMAIL in .env.test.local to run signed-in journeys.",
  );
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: emailAddress! });
}
