import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-admin";

const BASE = "http://localhost:3100";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

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

test.describe.serial("replies, wishes and gifts", () => {
  let token = "";

  test("admin sets up a family invitation and a KHQR payment method", async ({ page }) => {
    await adminSignIn(page);

    // Family with two members
    await gotoReady(page, "/admin/groups/new");
    await page.getByLabel("Group name (English)").fill("The Sok Family");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: /The Sok Family/ })).toBeVisible();
    for (const name of ["Sok Mother", "Sok Father"]) {
      await page.getByLabel("Name (English)").last().fill(name);
      await page.getByRole("button", { name: "Add member" }).click();
      await expect(page.getByRole("link", { name })).toBeVisible();
    }
    await page.getByRole("link", { name: "Create family invitation" }).click();
    await page.getByLabel("Link language").selectOption("en");
    await page.getByRole("button", { name: "Create" }).click();
    const link = page.getByRole("textbox", { name: "Invitation link" });
    await expect(link).toHaveValue(/\/en\/invitation\//);
    token = (await link.inputValue()).split("/invitation/")[1]!;

    // KHQR payment method
    await gotoReady(page, "/admin/payment-methods");
    await page.getByRole("button", { name: "Add payment details" }).click();
    await page.locator("#pm-label-en").fill("ABA – Sila");
    await page.locator("#pm-bank").fill("ABA Bank");
    await page.locator("#pm-holder").fill("MEAS SILA");
    await page.locator("input[type=file]").setInputFiles({ name: "khqr.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Shown to guests" })).toContainText("ABA – Sila");
  });

  test("family replies: chooses who comes, then updates the reply", async ({ page }) => {
    await gotoReady(page, `/en/rsvp/${token}`);
    await expect(page.getByRole("heading", { name: "Will you join us?" })).toBeVisible();
    await page.getByText("Joyfully attending").click();
    await page.getByRole("checkbox", { name: "Sok Father" }).uncheck();
    await page.getByLabel("Dietary requirements").fill("Vegetarian");
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
    await expect(page.getByText("We look forward to seeing you.")).toBeVisible();

    // Reload: the saved reply is pre-filled and can be changed
    await gotoReady(page, `/en/rsvp/${token}`);
    await expect(page.getByRole("checkbox", { name: "Sok Father" })).not.toBeChecked();
    await page.getByRole("checkbox", { name: "Sok Father" }).check();
    await page.getByRole("button", { name: "Update reply" }).click();
    await expect(page.getByText("We look forward to seeing all 2 of you.")).toBeVisible();

    // The invitation page shows the current reply
    await gotoReady(page, `/en/invitation/${token}`);
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect(page.locator("#rsvp")).toContainText("Joyfully attending");
  });

  test("a wish appears publicly only after the couple approves it", async ({ page, browser }) => {
    await gotoReady(page, `/en/invitation/${token}`);
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) await page.getByRole("button", { name: "Open invitation" }).click();
    await page.locator("#wishes").getByLabel("Your wish").fill("Wishing you a lifetime of happiness!");
    await page.locator("#wishes").getByRole("button", { name: "Send wish" }).click();
    await expect(page.getByText("Thank you for your wish!")).toBeVisible();

    const visitor = await browser.newPage();
    await visitor.goto(`${BASE}/en/wishes`);
    await expect(visitor.getByText("Wishing you a lifetime of happiness!")).toHaveCount(0);

    const admin = await browser.newContext();
    const ap = await admin.newPage();
    await adminSignIn(ap);
    await gotoReady(ap, "/admin/wishes");
    await expect(ap.getByText("Wishing you a lifetime of happiness!")).toBeVisible();
    await ap.getByRole("button", { name: "Approve" }).first().click();
    await expect(ap.getByText("Wish approved")).toBeVisible();
    await admin.close();

    await visitor.reload();
    await expect(visitor.getByText("Wishing you a lifetime of happiness!")).toBeVisible();
    await visitor.close();
  });

  test("guest sees KHQR details and notifies a gift; it stays pending", async ({ page }) => {
    await gotoReady(page, `/en/gift/${token}`);
    await expect(page.getByRole("heading", { name: "ABA – Sila" })).toBeVisible();
    await expect(page.getByRole("img", { name: "KHQR code for ABA – Sila" })).toBeVisible();
    await page.getByLabel("Amount").fill("12.345");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/Enter a valid amount/)).toBeVisible();
    await page.getByLabel("Amount").fill("100");
    await page.locator("input[type=file]").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("proof.png")).toBeVisible();
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Thank you so much!")).toBeVisible();
    await expect(page.getByText("The couple will confirm it once they check their account.")).toBeVisible();
  });

  test("couple confirms the gift; totals update per currency", async ({ page }) => {
    await adminSignIn(page);
    await gotoReady(page, "/admin/gifts?status=PENDING_VERIFICATION");
    await expect(page.getByText("1 gift to check")).toBeVisible();
    await page.getByRole("link", { name: "The Sok Family" }).first().click();
    await expect(page.getByRole("img", { name: "Screenshot from the guest" })).toBeVisible();
    await page.getByLabel("Amount received (USD)").fill("95");
    await page.getByRole("button", { name: "Confirm received" }).click();
    await expect(page.getByText("Gift confirmed")).toBeVisible();
    await expect(page.getByText("Confirmed received")).toBeVisible();

    await gotoReady(page, "/admin/gifts");
    await expect(page.getByText("US$95.00").first()).toBeVisible();
    await gotoReady(page, "/admin/dashboard");
    await expect(page.getByText("US$95.00")).toBeVisible();
  });
});
