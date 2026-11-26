"use client";

import { useTranslations } from "next-intl";

/** Translate a server error code (from an upload/route response) with a safe fallback. */
export function useErrorText() {
  const t = useTranslations("Errors");
  const loose = t as unknown as { (key: string, values?: Record<string, string | number>): string; has(key: string): boolean };
  return (code: string, values?: Record<string, string | number>) => (loose.has(code) ? loose(code, values) : loose("unexpected"));
}
