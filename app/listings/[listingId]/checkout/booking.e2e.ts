import { expect, test } from "@playwright/test";

import {
  dateFromToday,
  expectNoSeriousA11yViolations,
  signInTestUser,
} from "@/lib/testing/e2e";

// Books and then cancels a real (simulated-payment) reservation, so it runs
// once rather than per device.
test.describe("guest booking journey", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Mutating journey runs on desktop only.",
  );

  test("book an instant stay, see the trip, and cancel for a full refund", async ({
    page,
  }) => {
    await signInTestUser(page);

    await page.goto("/?mode=instant");
    const instant = page
      .locator("article")
      .filter({ hasText: "Instant book" })
      .locator('a[href^="/listings/"]')
      .first();
    const href = await instant.getAttribute("href");
    expect(href).toBeTruthy();

    // A random two-night stay months out keeps reruns from colliding.
    const offset = 150 + Math.floor(Math.random() * 150);
    const checkIn = dateFromToday(offset);
    const checkOut = dateFromToday(offset + 2);
    await page.goto(`${href}/checkout?checkIn=${checkIn}&checkOut=${checkOut}`);

    const confirm = page.getByRole("button", {
      name: /Confirm and pay .* \(simulated\)/,
    });
    await expect(confirm).toBeEnabled();
    await expectNoSeriousA11yViolations(page);
    await confirm.click();

    // Instant bookings hold the dates, then take a simulated payment.
    const pay = page.getByRole("button", { name: /^Pay .* \(simulated\)$/ });
    const booked = page.getByRole("heading", { name: "You're booked" });
    await expect(pay.or(booked)).toBeVisible();
    if (await pay.isVisible()) await pay.click();
    await expect(booked).toBeVisible({ timeout: 30_000 });

    const reservationId = new URL(page.url()).searchParams.get("reservation");
    expect(reservationId).toBeTruthy();

    await page.goto("/trips");
    await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible();

    await page.goto(`/trips/${reservationId}`);
    await page.getByRole("button", { name: "Cancel reservation" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Cancel this reservation?",
    });
    await expect(
      dialog.getByText(/Full refund: .* \(simulated\)/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel reservation" }).click();
    await expect(page.getByText("Cancelled").first()).toBeVisible();
  });
});
