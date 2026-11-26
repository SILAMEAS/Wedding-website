"use server";

import { cookies } from "next/headers";
import { isAppLocale } from "@/i18n/locales";
import { LOCALE_COOKIE } from "@/i18n/routing";

/** Admin language switch (admin URLs have no locale prefix; the cookie decides). */
export async function setAdminLocaleAction(locale: unknown): Promise<void> {
  if (!isAppLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
