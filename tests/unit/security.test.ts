import { describe, expect, it } from "vitest";
import { redact } from "@/lib/logger";
import { buildCsp, createNonce, staticSecurityHeaders } from "@/lib/security/csp";

describe("CSP", () => {
  it("uses a nonce with strict-dynamic and blocks framing/objects", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows WebAssembly compilation (not JS eval) only when asked, for the admin QR scanner", () => {
    const admin = buildCsp("n", false, { allowWasm: true });
    expect(admin).toContain("'wasm-unsafe-eval'");
    expect(admin).not.toMatch(/'unsafe-eval'/);
    expect(buildCsp("n", false)).not.toContain("wasm");
  });

  it("only allows unsafe-eval in development", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("generates unique, unpredictable nonces", () => {
    const nonces = new Set(Array.from({ length: 200 }, createNonce));
    expect(nonces.size).toBe(200);
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("adds HSTS only in production and keeps referrers same-origin", () => {
    const prod = staticSecurityHeaders(true).map((h) => h.key);
    expect(prod).toContain("Strict-Transport-Security");
    expect(staticSecurityHeaders(false).map((h) => h.key)).not.toContain("Strict-Transport-Security");
    expect(staticSecurityHeaders(false).find((h) => h.key === "Referrer-Policy")?.value).toBe("same-origin");
  });
});

describe("log redaction", () => {
  it("redacts sensitive keys at any depth", () => {
    const out = redact({
      user: "admin",
      password: "hunter2",
      nested: { invitationToken: "tok", guest: { phone: "012345678", name: "Sok" } },
      list: [{ sessionId: "s" }],
    });
    expect(JSON.stringify(out)).not.toMatch(/hunter2|tok"|012345678|"s"/);
    expect(out).toMatchObject({ user: "admin", nested: { guest: { name: "Sok" } } });
  });
});
