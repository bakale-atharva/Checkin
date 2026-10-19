import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  signInTestUser,
} from "@/lib/testing/e2e";

/** Signed-in guest pages load, pass axe, and fit narrow screens. */
for (const [path, heading] of [
  ["/trips", "Trips"],
  ["/wishlists", /Wishlists/],
  ["/notifications", /Notifications/],
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

test("/inbox is accessible and reflows", async ({ page }) => {
  await signInTestUser(page);
  await page.goto("/inbox");
  await expect(page.getByRole("main")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalOverflow(page);
});

test("narrow headers keep Trips and Wishlists in the account menu", async ({
  page,
}) => {
  await signInTestUser(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("link", { name: "Trips" })).toBeHidden();
});
