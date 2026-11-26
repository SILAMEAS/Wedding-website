import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-admin";

test("admin works on a phone: login and open the menu", async ({ page }) => {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: "http://localhost:3100" }]);
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Invitations" }).click();
  await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();

  // No horizontal page scroll on small screens.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("public landing page renders in Khmer on mobile", async ({ page }) => {
  await page.goto("/kh");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("មាស សិលា");
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
});
