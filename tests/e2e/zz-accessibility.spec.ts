import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-admin";

/**
 * Automated WCAG 2.1 A/AA scan (axe-core) of every public page and the main
 * admin screens, in both languages. Runs last so the database has content.
 */
const BASE = "http://localhost:3100";

async function scan(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  // Let entrance animations settle so contrast is measured on final colours.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(summary, `axe violations on ${url}`).toEqual([]);
}

test.describe.serial("accessibility", () => {
  let invitationPath = "";

  test("admin pages", async ({ page }) => {
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: BASE }]);
    await scan(page, "/admin/login");
    await page.getByLabel("Username").fill(E2E_ADMIN.username);
    await page.getByLabel("Password").fill(E2E_ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    // An invitation for the public scans below.
    await page.goto("/admin/guests/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name (English)").fill("Axe Visitor");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("link", { name: /Axe Visitor/ }).click();
    await page.getByRole("link", { name: "Create invitation" }).click();
    await page.getByLabel("Link language").selectOption("en");
    await page.getByRole("button", { name: "Create" }).click();
    const link = await page.getByRole("textbox", { name: "Invitation link" }).inputValue();
    invitationPath = new URL(link).pathname;

    for (const url of [
      "/admin/dashboard",
      "/admin/invitations",
      "/admin/guests",
      "/admin/groups",
      "/admin/content",
      "/admin/gallery",
      "/admin/gifts",
      "/admin/wishes",
      "/admin/check-in",
      "/admin/analytics",
      "/admin/exports",
      "/admin/audit-logs",
      "/admin/security",
    ]) {
      await scan(page, url);
    }
  });

  test("public pages in Khmer and English", async ({ page }) => {
    expect(invitationPath).not.toBe("");
    for (const locale of ["en", "kh"]) {
      for (const path of ["", "/gallery", "/location", "/wishes"]) await scan(page, `/${locale}${path}`);
    }
    await scan(page, invitationPath);
    // Opened state (envelope dismissed) as well as the envelope itself.
    const open = page.getByRole("button", { name: /Open invitation/ });
    if (await open.isVisible()) {
      await open.click();
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations.map((v) => v.id)).toEqual([]);
    }
    await scan(page, invitationPath.replace("/invitation/", "/rsvp/"));
    await scan(page, invitationPath.replace("/invitation/", "/gift/"));
  });
});
