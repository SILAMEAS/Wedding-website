#!/usr/bin/env node
/**
 * Post-deployment smoke test. Read-only: it never signs in or changes data.
 *
 *   node scripts/smoke-test.mjs https://your-domain.example
 *   npm run smoke -- http://localhost:5000
 *
 * Exits with code 1 if any check fails.
 */
const base = (process.argv[2] ?? process.env.APP_URL ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: node scripts/smoke-test.mjs <base-url>");
  process.exit(2);
}
const isHttps = base.startsWith("https://");

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL  ${name}\n        ${error instanceof Error ? error.message : String(error)}`);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const get = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { "user-agent": "wedding-smoke-test", ...init.headers } });

console.log(`Smoke test: ${base}\n`);

await check("health endpoint reports the database is up", async () => {
  const res = await get("/api/health");
  assert(res.status === 200, `status ${res.status}`);
  const body = await res.json();
  assert(body.status === "ok" && body.db === "ok", JSON.stringify(body));
});

await check("home page redirects to a language", async () => {
  const res = await get("/");
  assert([200, 307, 308].includes(res.status), `status ${res.status}`);
});

for (const locale of ["kh", "en"]) {
  await check(`/${locale} renders with security headers`, async () => {
    const res = await get(`/${locale}`);
    assert(res.status === 200, `status ${res.status}`);
    const csp = res.headers.get("content-security-policy") ?? "";
    assert(/'nonce-[A-Za-z0-9+/=]+'/.test(csp), "CSP nonce missing");
    assert(csp.includes("frame-ancestors 'none'"), "frame-ancestors missing");
    assert(!csp.includes("wasm-unsafe-eval"), "public pages must not allow wasm");
    assert(res.headers.get("x-content-type-options") === "nosniff", "nosniff missing");
    assert(res.headers.get("referrer-policy") === "same-origin", "referrer-policy wrong");
    if (isHttps) assert((res.headers.get("strict-transport-security") ?? "").includes("max-age="), "HSTS missing");
    const html = await res.text();
    assert(html.includes(`lang="${locale === "kh" ? "km" : "en"}"`), "html lang attribute wrong");
  });
}

for (const path of ["/kh/gallery", "/kh/location", "/kh/wishes"]) {
  await check(`${path} renders`, async () => {
    const res = await get(path);
    assert(res.status === 200, `status ${res.status}`);
  });
}

await check("unknown invitation link is not cached publicly", async () => {
  const res = await get("/kh/invitation/smoke-test-not-a-real-token-000000000000000");
  assert(res.status < 500, `status ${res.status}`);
  const cc = res.headers.get("cache-control") ?? "";
  assert(!cc.includes("public"), `cache-control: ${cc}`);
});

await check("admin pages require sign-in", async () => {
  const res = await get("/admin/dashboard");
  assert([302, 303, 307, 308].includes(res.status), `status ${res.status}`);
  assert((res.headers.get("location") ?? "").includes("/admin/login"), `location: ${res.headers.get("location")}`);
});

await check("admin login page loads", async () => {
  const res = await get("/admin/login");
  assert(res.status === 200, `status ${res.status}`);
});

await check("admin downloads reject anonymous requests", async () => {
  const res = await get("/api/admin/exports/guests?format=csv");
  assert(res.status === 401, `status ${res.status}`);
});

await check("cleanup cron rejects requests without the secret", async () => {
  const res = await get("/api/cron/cleanup", { headers: { authorization: "Bearer wrong" } });
  assert(res.status === 401, `status ${res.status}`);
});

await check("QR scanner decoder is self-hosted", async () => {
  const res = await get("/vendor/zxing_reader.wasm", { method: "HEAD" });
  assert(res.status === 200, `status ${res.status}`);
});

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
