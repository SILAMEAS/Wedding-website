/**
 * Admin session cookie. In production the `__Host-` prefix forces
 * Secure + Path=/ + no Domain, so the cookie cannot be set or read by
 * subdomains or over plain HTTP. Development (http://localhost) uses a plain name.
 * Safe to import from proxy.ts (no Node-only APIs).
 */
export function adminSessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-wedding_admin" : "wedding_admin";
}

export function adminSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}
