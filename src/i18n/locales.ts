/**
 * Locale helpers shared by server and client.
 *
 * URL/app locale codes are `kh` and `en` (as specified). `kh` is NOT a valid
 * BCP-47 language tag — `Intl` silently falls back to English for it — so all
 * formatting and the <html lang> attribute use the real tag `km` / `km-KH`.
 */
export const locales = ["kh", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "en" ? "en" : "kh";

export const WEDDING_TIME_ZONE = "Asia/Phnom_Penh";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** BCP-47 tag for Intl APIs. */
export function intlLocale(locale: AppLocale): string {
  return locale === "kh" ? "km-KH" : "en-GB";
}

/** Value for <html lang>. */
export function htmlLang(locale: AppLocale): string {
  return locale === "kh" ? "km" : "en";
}

export function otherLocale(locale: AppLocale): AppLocale {
  return locale === "kh" ? "en" : "kh";
}
