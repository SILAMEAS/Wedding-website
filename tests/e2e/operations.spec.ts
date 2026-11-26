import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-admin";

const BASE = "http://localhost:3100";

async function adminSignIn(page: Page) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: BASE }]);
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("wedding-day operations", () => {
  test("check in a guest by name, block a duplicate, then undo", async ({ page }) => {
    await adminSignIn(page);

    await gotoReady(page, "/admin/guests/new");
    await page.getByLabel("Name (English)").fill("Keo Bopha");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("link", { name: /Keo Bopha/ }).click();
    await page.getByRole("link", { name: "Create invitation" }).click();
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("textbox", { name: "Invitation link" })).toBeVisible();

    await gotoReady(page, "/admin/check-in");
    await expect(page.getByRole("heading", { name: "Check-in", level: 1 })).toBeVisible();
    await page.getByPlaceholder("Name or phone number").fill("Keo");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: /Keo Bopha/ }).click();
    await page.getByRole("button", { name: /Welcome 1 guest/ }).click();
    await expect(page.getByText(/Keo Bopha welcomed/)).toBeVisible();

    // A second scan of the same party is blocked without an override.
    await page.getByPlaceholder("Name or phone number").fill("Keo");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: /Keo Bopha/ }).click();
    await expect(page.getByText(/already arrived/)).toBeVisible();
    const welcome = page.getByRole("button", { name: /Welcome 1 guest/ });
    await expect(welcome).toBeDisabled();
    await page.getByLabel("Check in anyway").check();
    await page.getByLabel("Reason").fill("Second car arrived later");
    await welcome.click();
    await expect(page.getByText(/Keo Bopha welcomed/)).toBeVisible();
    await expect(page.getByText("Override").first()).toBeVisible();

    // Undo from the recent list.
    await page.getByRole("button", { name: "Undo check-in" }).first().click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel("Reason").fill("Test entry");
    await dialog.getByRole("button", { name: "Undo check-in" }).click();
    await expect(page.getByText("Check-in undone")).toBeVisible();
  });

  test("analytics renders charts with table fallbacks", async ({ page }) => {
    await adminSignIn(page);
    await gotoReady(page, "/admin/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByText("Replies by answer")).toBeVisible();
    await expect(page.getByText("Confirmed gifts in USD")).toBeVisible();
    await expect(page.getByText("Show as table").first()).toBeVisible();
  });

  test("downloads a guest list as CSV and Excel", async ({ page }) => {
    await adminSignIn(page);
    await gotoReady(page, "/admin/exports");
    const card = page.locator("[data-slot=card]", { has: page.getByText("Names, phone, category") });

    const [csv] = await Promise.all([page.waitForEvent("download"), card.getByRole("link", { name: "Download as CSV" }).click()]);
    expect(csv.suggestedFilename()).toMatch(/^wedding-guests-.*\.csv$/);
    const body = await (await csv.createReadStream()).toArray();
    expect(Buffer.concat(body).toString("utf8")).toContain("Keo Bopha");

    const [xlsx] = await Promise.all([page.waitForEvent("download"), card.getByRole("link", { name: /Excel/ }).click()]);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("guest list sorts by column through the URL", async ({ page }) => {
    await adminSignIn(page);
    await gotoReady(page, "/admin/guests");
    await page.getByRole("button", { name: "Category", exact: true }).click();
    await expect(page).toHaveURL(/sort=category/);
    await expect(page.getByRole("columnheader", { name: "Category" })).toHaveAttribute("aria-sort", /ascending|descending/);
  });
});
