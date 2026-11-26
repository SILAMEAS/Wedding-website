import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { adminSessionCookieName } from "@/lib/auth/session-cookie";
import { buildCsp, createNonce } from "@/lib/security/csp";

/**
 * Proxy (Next.js 16's renamed middleware). Responsibilities:
 *  1. Per-request CSP nonce (forwarded as a request header so Next.js applies
 *     it to its own scripts, and so layouts can read it).
 *  2. Locale routing for the public site (next-intl).
 *  3. Optimistic redirect to /admin/login when no admin cookie is present.
 * It is NOT the authorization layer: admin access is verified server-side in
 * every protected layout, Server Action and Route Handler.
 */
const handleI18nRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const nonce = createNonce();
  // WebAssembly (QR scanner) only in the admin area; admin pages navigate client-side, so allow it for all of /admin.
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development", { allowWasm: request.nextUrl.pathname.startsWith("/admin") });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // Optimistic only: avoids rendering admin pages for visitors with no session
  // cookie at all. The session itself is validated server-side (requireAdmin).
  if (isAdmin && pathname !== "/admin/login" && !request.cookies.has(adminSessionCookieName())) {
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  const response = isAdmin
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : handleI18nRouting(new NextRequest(request, { headers: requestHeaders }));

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Skip API routes, Next internals and files with an extension.
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
