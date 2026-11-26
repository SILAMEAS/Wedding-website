import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./e2e-admin";

const BASE = "http://localhost:3100";
// 1x1 PNG
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

test.describe.serial("guest invitation experience", () => {
  let invitationUrl = "";
  let albumPath = "";

  test("admin prepares content and an invitation", async ({ page }) => {
    await adminSignIn(page);

    // Wedding details
    await gotoReady(page, "/admin/content");
    await page.locator("#groomName-en").fill("Sila");
    await page.locator("#brideName-en").fill("Kimsour");
    await page.locator("#weddingDate").fill("2099-01-15T17:30");
    await page.locator("#invitationMessage-en").fill("Together with our families we invite you.");
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Saved").first()).toBeVisible();

    // Venue
    await gotoReady(page, "/admin/locations/new");
    await page.locator("#name-en").fill("Grand Garden Hall");
    await page.locator("#address-en").fill("Street 1, Phnom Penh");
    await page.getByLabel("Latitude").fill("11.5564");
    await page.getByLabel("Longitude").fill("104.9282");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/locations$/);

    // Event at that venue
    await gotoReady(page, "/admin/events/new");
    await page.locator("#title-en").fill("Wedding Reception");
    await page.getByLabel("Starts").fill("2099-01-15T17:30");
    await page.getByLabel("Venue").selectOption({ label: "Grand Garden Hall" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/events$/);

    // Guests-only album with one uploaded photo
    await gotoReady(page, "/admin/gallery");
    await page.getByRole("button", { name: "New album" }).click();
    await page.locator("#album-title-en").fill("Pre-wedding in Kep");
    await page.getByLabel("Who can see this album").selectOption("INVITATION_ONLY");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/gallery\/[0-9a-f-]+$/);
    await page.locator("input[type=file][multiple]").setInputFiles({ name: "kep.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("1 photo added")).toBeVisible();
    albumPath = "/en/gallery/pre-wedding-in-kep";

    // Guest + invitation
    await gotoReady(page, "/admin/guests/new");
    await page.getByLabel("Name (English)").fill("Dara Guest");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/guests$/);
    await page.getByRole("link", { name: /Dara Guest/ }).click();
    await page.getByRole("link", { name: "Create invitation" }).click();
    await page.getByLabel("Link language").selectOption("en");
    await page.getByRole("button", { name: "Create" }).click();
    const link = page.getByRole("textbox", { name: "Invitation link" });
    await expect(link).toHaveValue(/\/en\/invitation\//);
    invitationUrl = (await link.inputValue()).replace(/^https?:\/\/[^/]+/, BASE);
  });

  test("guest opens the envelope and sees the personalized invitation", async ({ browser }) => {
    const guest = await browser.newContext();
    const page = await guest.newPage();
    await page.goto(invitationUrl);

    // Personalized envelope; generic page title (no guest name leaked to link previews)
    await expect(page.getByRole("dialog")).toContainText("Dear Dara Guest");
    await expect(page).not.toHaveTitle(/Dara/);
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Content
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sila");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kimsour");
    await expect(page.getByText("Together with our families we invite you.")).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wedding Reception" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grand Garden Hall" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", /destination=11\.5564/);
    await expect(page.getByRole("link", { name: /Pre-wedding in Kep/ })).toBeVisible();

    // Reload in the same session skips the envelope
    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Guests-only album is accessible after opening the invitation; lightbox opens
    await page.goto(albumPath);
    await expect(page.getByRole("heading", { name: "Pre-wedding in Kep" })).toBeVisible();
    await page.getByRole("button", { name: "Open photo 1 of 1" }).click();
    await expect(page.locator(".yarl__root")).toBeVisible();
    await page.keyboard.press("Escape");
    await guest.close();
  });

  test("strangers cannot see guests-only albums", async ({ browser }) => {
    const stranger = await browser.newContext();
    const page = await stranger.newPage();
    await page.goto("/en/gallery");
    await expect(page.getByText("Photos will be shared here soon.")).toBeVisible();
    await page.goto(albumPath);
    await expect(page.getByRole("heading", { name: "For invited guests" })).toBeVisible();
    await expect(page.locator("img")).toHaveCount(0);
    await stranger.close();
  });

  test("invalid and replaced links show the right message", async ({ page, browser }) => {
    await page.goto("/en/invitation/not-a-real-token");
    await expect(page.getByRole("heading", { name: "Invitation not found" })).toBeVisible();

    // Admin generates a new link; the old one becomes inactive
    const admin = await browser.newContext();
    const ap = await admin.newPage();
    await adminSignIn(ap);
    await gotoReady(ap, "/admin/invitations?q=Dara");
    await ap.getByRole("link", { name: /Dara Guest/ }).click();
    await ap.getByRole("button", { name: "Generate new link" }).click();
    await ap.getByRole("alertdialog").getByRole("button", { name: "Generate new link" }).click();
    await expect(ap.getByText("Replaced")).toBeVisible();
    await admin.close();

    await page.goto(invitationUrl);
    await expect(page.getByRole("heading", { name: "This link is no longer active" })).toBeVisible();
  });
});
