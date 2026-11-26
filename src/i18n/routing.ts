import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Public site: always-prefixed URLs (/kh/..., /en/...).
 * Admin (/admin/...) is not prefixed; it reads the same cookie (see request.ts).
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
});
