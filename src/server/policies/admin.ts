import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminSessionCookieName } from "@/lib/auth/session-cookie";
import { getRequestMeta } from "@/lib/request-meta";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { validateSession } from "@/server/services/auth.service";

/**
 * The real authorization gate (proxy.ts only does an optimistic redirect).
 * Called by every protected layout, page, Server Action and Route Handler.
 * `cache` dedupes the DB lookup within one request.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const token = (await cookies()).get(adminSessionCookieName())?.value;
  if (!token) return null;
  const meta = await getRequestMeta();
  return validateSession(token, meta.ipHash);
});

/** For pages/layouts: redirects to the login page when not authenticated. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return ctx;
}

/** For Server Actions and Route Handlers: throws (no redirect side effects). */
export async function requireAdminOrThrow(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new AppError("unauthorized");
  return ctx;
}
