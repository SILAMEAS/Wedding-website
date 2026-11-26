import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("TEST_DATABASE_URL is required for e2e tests");

/**
 * End-to-end tests run a dev server on :3100 against the TEST database
 * (never the dev database), using its own build dir (.next-e2e), so it can
 * run while your normal `npm run dev` is up.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generous: the dev server compiles each route on first request.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure", locale: "en-GB" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: testDb, DIRECT_URL: testDb, APP_URL: BASE_URL, LOG_LEVEL: "warn", NEXT_DIST_DIR: ".next-e2e", LOCAL_UPLOAD_DIR: ".uploads-e2e" },
  },
});
