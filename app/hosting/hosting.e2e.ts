import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  signInTestUser,
} from "@/lib/testing/e2e";

test.describe("host journeys", () => {
  test("start a draft listing, then delete it", async ({ page, isMobile }) => {
    test.skip(isMobile, "Mutating journey runs on desktop only.");
    await signInTestUser(page);

    await page.goto("/hosting");
    await expect(
      page.getByRole("heading", { name: "Your properties" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create a listing" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/hosting\/listings\/[a-z0-9]+/);
    const listingPath = new URL(page.url()).pathname;
    await expect(page.getByText("New listing").first()).toBeVisible();

    await page.goto("/hosting");
    const row = page
      .getByRole("listitem")
      .filter({ has: page.locator(`a[href="${listingPath}"]`) });
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Delete draft" }).click();
    await expect(page.locator(`a[href="${listingPath}"]`)).toHaveCount(0);
  });

  for (const [path, heading] of [
    ["/hosting", "Your properties"],
    ["/hosting/calendar", /Calendar/],
    ["/hosting/earnings", "Earnings"],
    ["/hosting/plans", /Plan/],
  ] as const) {
    test(`${path} is accessible and reflows`, async ({ page }) => {
      await signInTestUser(page);
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
    });
  }
});
