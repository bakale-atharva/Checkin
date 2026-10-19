import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  listingLinks,
} from "@/lib/testing/e2e";

test.describe("discovery", () => {
  test("lists stays and keeps filters in the URL", async ({ page }) => {
    const links = await listingLinks(page);
    await expect(links.first()).toBeVisible();

    await page.getByRole("button", { name: /Beachfront/ }).click();
    await expect(page).toHaveURL(/category=beachfront/i);
    await expect(
      page.getByRole("heading", { level: 2, name: /stays?|No stays/ }),
    ).toBeVisible();

    // Reloading restores the same filtered view from the URL.
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Beachfront/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await listingLinks(page);
    await expectNoSeriousA11yViolations(page);
  });

  test("offers a skip link to the page content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#content")).toBeFocused();
  });

  test("keeps the small-screen map view across reloads", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await listingLinks(page);

    await page.getByRole("button", { name: "Show map" }).click();
    await expect(page).toHaveURL(/view=map/);
    await page.reload();
    await expect(page.getByRole("button", { name: "Show list" })).toBeVisible();

    await page.getByRole("button", { name: "Show list" }).click();
    await expect(page).not.toHaveURL(/view=map/);
  });

  test("fits a 320px screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await listingLinks(page);
    await expectNoHorizontalOverflow(page);
  });
});
