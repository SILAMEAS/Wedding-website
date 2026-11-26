import { z } from "zod";
import { type AppLocale, otherLocale } from "@/i18n/locales";

/**
 * Localized content stored in Json columns: { en: string, kh: string }.
 * Every write passes through one of these schemas; every read through
 * `parseLocalized` (tolerant) + `pickLocalized` (fallback to the other language).
 */

export type LocalizedText = { en: string; kh: string };

const part = (max: number) => z.string().trim().max(max).default("");

/** Optional localized text: both languages may be blank. */
export function localizedText(max = 2000) {
  return z.object({ en: part(max), kh: part(max) });
}

/** Required localized text: at least one language must be filled in. */
export function requiredLocalizedText(max = 2000) {
  return localizedText(max).refine((v) => v.en.length > 0 || v.kh.length > 0, {
    message: "Enter the text in at least one language",
  });
}

const tolerant = z.object({ en: z.string().catch(""), kh: z.string().catch("") }).catch({ en: "", kh: "" });

/** Safely read a Json column value (never throws; malformed data becomes empty). */
export function parseLocalized(value: unknown): LocalizedText {
  return tolerant.parse(value ?? {});
}

export type PickedText = { text: string; isFallback: boolean; lang: AppLocale };

/** Returns the text in `locale`, falling back to the other language when blank. */
export function pickLocalized(value: unknown, locale: AppLocale): PickedText {
  const v = parseLocalized(value);
  const primary = v[locale].trim();
  if (primary) return { text: primary, isFallback: false, lang: locale };
  const other = otherLocale(locale);
  return { text: v[other].trim(), isFallback: v[other].trim().length > 0, lang: other };
}

export function isLocalizedEmpty(value: unknown): boolean {
  const v = parseLocalized(value);
  return !v.en.trim() && !v.kh.trim();
}

/** Which languages still need a translation (for admin "missing translation" badges). */
export function missingLocales(value: unknown): AppLocale[] {
  const v = parseLocalized(value);
  if (!v.en.trim() && !v.kh.trim()) return [];
  return (["kh", "en"] as const).filter((l) => !v[l].trim());
}
