import { describe, expect, it } from "vitest";
import { buildPgConfig } from "@/lib/prisma/create-client";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

describe("database TLS config", () => {
  it("leaves the URL alone when no CA is configured", () => {
    const url = "postgres://u:p@db.example.com:5432/app?sslmode=require";
    expect(buildPgConfig(url, undefined)).toEqual({ connectionString: url });
    expect(buildPgConfig(url, "  ")).toEqual({ connectionString: url });
  });

  it("verifies the server with the given CA and strips ssl params that would override it", () => {
    const cfg = buildPgConfig("postgres://u:p@db.example.com:5432/app?sslmode=require&application_name=wedding", PEM);
    expect(cfg.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(cfg.connectionString).not.toContain("sslmode");
    expect(cfg.connectionString).toContain("application_name=wedding");
  });

  it("accepts a one-line PEM with literal \n sequences", () => {
    const cfg = buildPgConfig("postgres://u:p@h/app?sslmode=verify-full", PEM.replace(/\n/g, "\n"));
    expect(cfg.ssl?.ca).toBe(PEM);
  });

  it("does not force TLS on a local database without sslmode", () => {
    const url = "postgresql://wedding:x@localhost:5433/wedding_test";
    expect(buildPgConfig(url, PEM)).toEqual({ connectionString: url });
    expect(buildPgConfig(`${url}?sslmode=disable`, PEM).ssl).toBeUndefined();
  });
});
