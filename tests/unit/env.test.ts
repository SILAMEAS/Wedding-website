import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5433/db",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: randomBytes(32).toString("base64url"),
  TOKEN_HASH_PEPPER: randomBytes(32).toString("base64url"),
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  CRON_SECRET: randomBytes(32).toString("base64url"),
};

describe("environment validation", () => {
  it("accepts a complete development config and applies defaults", () => {
    const env = parseEnv(valid);
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe("kh");
    expect(env.TIME_ZONE).toBe("Asia/Phnom_Penh");
    expect(env.MEDIA_STORAGE).toBe("local");
  });

  it("rejects short secrets", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });

  it("requires a 32-byte encryption key", () => {
    expect(() => parseEnv({ ...valid, TOKEN_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("treats empty strings as missing", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("requires Cloudinary and https in production", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production" })).toThrow(/MEDIA_STORAGE[\s\S]*APP_URL/);
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        APP_URL: "https://example.com",
        MEDIA_STORAGE: "cloudinary",
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: "k",
        CLOUDINARY_API_SECRET: "s",
      }),
    ).not.toThrow();
  });

  it("never echoes secret values in error messages", () => {
    const secret = "x".repeat(10);
    try {
      parseEnv({ ...valid, AUTH_SECRET: secret });
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });
});
