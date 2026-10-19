import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations, listingLinks } from "@/lib/testing/e2e";

test.describe("resilience", () => {
  test("unknown pages show a helpful not-found state", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(
      page.getByRole("heading", { name: "We couldn’t find that page" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse stays" }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("a malformed stay link recovers instead of crashing", async ({
    page,
  }) => {
    await page.goto("/listings/not-a-real-id");
    await expect(
      page.getByRole("heading", { name: "We couldn’t open this stay" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.getByRole("link", { name: "Browse other stays" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("explains when live data stops updating", async ({ page, context }) => {
    await listingLinks(page);
    const banner = page.getByText(/You’re offline/);
    await context.setOffline(true);
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await context.setOffline(false);
    await expect(banner).toBeHidden({ timeout: 30_000 });
  });

  for (const path of [
    "/trips",
    "/wishlists",
    "/inbox",
    "/notifications",
    "/hosting",
  ]) {
    test(`${path} asks signed-out visitors to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/sign-in/);
    });
  }
});
