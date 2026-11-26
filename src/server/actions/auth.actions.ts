"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { changePasswordSchema, loginSchema } from "@/features/auth/schemas";
import { adminSessionCookieName, adminSessionCookieOptions } from "@/lib/auth/session-cookie";
import { getRequestMeta } from "@/lib/request-meta";
import { type ActionResult, runAction } from "@/server/action-result";
import { getAdminContext } from "@/server/policies/admin";
import * as auth from "@/server/services/auth.service";
import { adminAction } from "./admin-action";

export async function loginAction(input: unknown): Promise<ActionResult> {
  const result = await runAction("auth.login", loginSchema, input, async ({ username, password }) => {
    const { sessionToken, expiresAt } = await auth.login(username, password, await getRequestMeta());
    (await cookies()).set(adminSessionCookieName(), sessionToken, adminSessionCookieOptions(expiresAt));
    return undefined;
  });
  if (result.ok) redirect("/admin/dashboard");
  return result;
}

export async function logoutAction(): Promise<void> {
  const ctx = await getAdminContext();
  if (ctx) await auth.logout(ctx);
  (await cookies()).delete(adminSessionCookieName());
  redirect("/admin/login");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return adminAction("auth.changePassword", changePasswordSchema, input, async (ctx, d) => {
    await auth.changePassword(ctx, d.currentPassword, d.newPassword);
  });
}

export async function revokeSessionAction(sessionId: unknown): Promise<ActionResult> {
  return adminAction("auth.revokeSession", z.uuid(), sessionId, async (ctx, id) => {
    await auth.revokeSession(ctx, id);
  });
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<number>> {
  return adminAction("auth.revokeOtherSessions", z.undefined(), undefined, (ctx) => auth.revokeOtherSessions(ctx));
}
