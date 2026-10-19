import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  listingLinks,
} from "@/lib/testing/e2e";

test.describe("listing detail", () => {
  test.beforeEach(async ({ page }) => {
    const links = await listingLinks(page);
    await links.first().click();
    await expect(page).toHaveURL(/\/listings\/[a-z0-9]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("selecting dates updates the URL and the estimate", async ({ page }) => {
    const available = page.locator(
      'button[data-date][aria-disabled="false"]:visible',
    );
    await expect(available.first()).toBeVisible();
    // Skip a week ahead so the stay isn't right on today's boundary.
    const checkIn = available.nth(7);
    const checkInDate = await checkIn.getAttribute("data-date");
    await checkIn.click();
    await expect(page).toHaveURL(new RegExp(`checkIn=${checkInDate}`));

    await page
      .locator('button[data-date][aria-disabled="false"]:visible')
      .filter({ hasNot: page.locator('[aria-pressed="true"]') })
      .nth(8)
      .click();
    await expect(page).toHaveURL(/checkOut=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByText(/simulated|estimate/i).first()).toBeVisible();
  });

  test("photo viewer traps focus and returns it on close", async ({ page }) => {
    const opener = page.getByRole("button", { name: /Show all \d+ photos/ });
    test.skip((await opener.count()) === 0, "This stay has a single photo.");
    await opener.click();
    const viewer = page.getByRole("dialog", { name: /photos/ });
    await expect(viewer).toBeVisible();
    await expect(
      viewer.getByRole("button", { name: "Close photos" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByText(/^2 \/ \d+$/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Availability" }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("reflows at 200% zoom", async ({ page }) => {
    // A 1280px laptop at 200% zoom lays out like a 640px viewport.
    await page.setViewportSize({ width: 640, height: 800 });
    await expectNoHorizontalOverflow(page);
  });
});
