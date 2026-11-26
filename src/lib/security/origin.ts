import { env } from "@/lib/env";

/**
 * CSRF guard for state-changing Route Handlers (Server Actions get this from
 * Next.js automatically). Accepts the request only when the browser says it
 * came from our own origin.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    // In development the app may be served on another port than APP_URL (e.g. e2e on :3100).
    const allowed = new Set([new URL(env().APP_URL).origin, new URL(request.url).origin]);
    return allowed.has(origin);
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}
