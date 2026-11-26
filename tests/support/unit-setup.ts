// Deterministic, test-only environment for unit tests (never real secrets).
const defaults: Record<string, string> = {
  DATABASE_URL: "postgresql://unit:unit@localhost:5432/unit_test",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "unit-test-auth-secret-0123456789abcdef",
  TOKEN_HASH_PEPPER: "unit-test-token-pepper-0123456789abcdef",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: "unit-test-cron-secret-0123456789abcdef",
  MEDIA_STORAGE: "local",
};
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
