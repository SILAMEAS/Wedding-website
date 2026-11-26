import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-admin";

async function switchToEnglish(page: Page) {
  // Admin defaults to Khmer; tests use English labels.
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: "http://localhost:3100" }]);
}

async function signIn(page: Page, password = E2E_ADMIN.password) {
  await switchToEnglish(page);
  await page.goto("/admin/login");
  // Dev server compiles on first hit: wait until hydrated before interacting.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Wait for the session cookie to be set before navigating elsewhere.
  if (password === E2E_ADMIN.password) await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test.describe("admin access control", () => {
  test("unauthenticated visitors are sent to the login page", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("a forged session cookie is rejected server-side", async ({ page, context }) => {
    await context.addCookies([{ name: "wedding_admin", value: "forged-token-value", url: "http://localhost:3100" }]);
    await page.goto("/admin/invitations");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("QR download API requires a session", async ({ request }) => {
    const res = await request.get("/api/admin/invitations/00000000-0000-4000-8000-000000000000/qr");
    expect(res.status()).toBe(401);
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await signIn(page, "definitely not the password");
    // (getByRole("alert") would also match Next.js route announcer)
    await expect(page.getByText("Incorrect username or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("admin workflow", () => {
  test("sign in, add a guest, create and share an individual invitation", async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Add guest
    await page.getByRole("link", { name: "Guests" }).first().click();
    await page.getByRole("link", { name: "Add guest" }).click();
    await page.getByLabel("Name (Khmer)").fill("សុខ ដារ៉ា");
    await page.getByLabel("Name (English)").fill("Sok Dara");
    await page.getByLabel("Phone").fill("012 345 678");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/guests$/);
    await expect(page.getByRole("link", { name: /Sok Dara/ })).toBeVisible();

    // Create invitation from the guest page
    await page.getByRole("link", { name: /Sok Dara/ }).click();
    await page.getByRole("link", { name: "Create invitation" }).click();
    await expect(page.getByLabel("Guest", { exact: true })).toHaveValue(/.+/);
    await page.getByRole("button", { name: "Create" }).click();

    // Link is revealed right after creation
    await expect(page.getByText("Your invitation link is ready")).toBeVisible();
    const link = page.getByRole("textbox", { name: "Invitation link" });
    await expect(link).toHaveValue(/^http:\/\/localhost:3100\/(kh|en)\/invitation\/[A-Za-z0-9_-]{43}$/);
    const firstUrl = await link.inputValue();

    // QR download works for an authenticated admin
    const qr = await page.request.get(page.url().replace(/\?.*$/, "").replace("/admin/invitations/", "/api/admin/invitations/") + "/qr?format=png");
    expect(qr.status()).toBe(200);
    expect(qr.headers()["content-type"]).toBe("image/png");

    // Generate a new link: different token, old one marked replaced
    await page.getByRole("button", { name: "Generate new link" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Generate new link" }).click();
    await expect(link).not.toHaveValue(firstUrl);
    await expect(page.getByText("Replaced")).toBeVisible();

    // Activity log recorded the actions
    await page.getByRole("link", { name: "Activity log" }).click();
    await expect(page.getByText("invitation.token_rotate")).toBeVisible();
    await expect(page.getByText("invitation.create")).toBeVisible();
  });

  test("family group with members gets one family invitation", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/groups/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Group name (Khmer)").fill("គ្រួសារ លោក ចាន់");
    await page.getByLabel("Group name (English)").fill("The Chan Family");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: /The Chan Family/ })).toBeVisible();

    for (const name of ["Chan Bopha", "Chan Vichea"]) {
      await page.getByLabel("Name (English)").last().fill(name);
      await page.getByRole("button", { name: "Add member" }).click();
      await expect(page.getByRole("link", { name })).toBeVisible();
    }

    await page.getByRole("link", { name: "Create family invitation" }).click();
    await expect(page.getByLabel("Capacity")).toHaveValue("2");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Your invitation link is ready")).toBeVisible();
    await expect(page.getByText("Chan Bopha")).toBeVisible();
    await expect(page.getByText("Chan Vichea")).toBeVisible();
  });

  test("admin language switch to Khmer", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "ខ្មែរ" }).first().click();
    await expect(page.getByRole("heading", { name: "ផ្ទាំងសង្ខេប" })).toBeVisible();
  });

  test("sign out ends the session", async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
