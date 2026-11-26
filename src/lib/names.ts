import type { AppLocale } from "@/i18n/locales";

/** Name in the preferred language, falling back to the other one. */
export function displayName(p: { nameEn: string | null; nameKh: string | null }, locale: AppLocale): string {
  const en = p.nameEn?.trim() ?? "";
  const kh = p.nameKh?.trim() ?? "";
  return locale === "kh" ? kh || en : en || kh;
}

/** Both names for admin tables, e.g. "សុខ ដារ៉ា · Sok Dara". */
export function bilingualName(p: { nameEn: string | null; nameKh: string | null }): string {
  return [p.nameKh?.trim(), p.nameEn?.trim()].filter(Boolean).join(" · ");
}
