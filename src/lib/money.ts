// Browser-safe entrypoint (no DB runtime), so these helpers also work in Client Components.
import { Decimal } from "@/generated/prisma/internal/prismaNamespaceBrowser";
import { type AppLocale, intlLocale } from "@/i18n/locales";

/** Accepts both Prisma's server Decimal and the browser Decimal (anything with an exact toString). */
type DecimalLike = { toString(): string };
/** Instance type of the browser-safe Decimal class. */
export type DecimalValue = InstanceType<typeof Decimal>;

/**
 * Money rules (spec §2 Gifts, §6.7):
 *  - Decimal end to end, never JS floating point.
 *  - Amounts cross JSON / forms as strings.
 *  - USD has at most 2 fraction digits; KHR is whole riel.
 *  - USD and KHR are NEVER summed together.
 */
export const CURRENCIES = ["USD", "KHR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const MAX_AMOUNT = new Decimal("9999999999999999.99"); // fits Decimal(18,2)
const PATTERN: Record<CurrencyCode, RegExp> = {
  USD: /^\d{1,16}(\.\d{1,2})?$/,
  KHR: /^\d{1,16}$/,
};

export type ParsedAmount = { ok: true; value: DecimalValue } | { ok: false; reason: "format" | "nonPositive" | "tooLarge" };

/** Parse a user-entered amount string ("1,250.50" allowed) for a given currency. */
export function parseAmount(input: string, currency: CurrencyCode): ParsedAmount {
  const normalized = input.trim().replace(/[,\s]/g, "");
  if (!PATTERN[currency].test(normalized)) return { ok: false, reason: "format" };
  const value = new Decimal(normalized);
  if (value.lte(0)) return { ok: false, reason: "nonPositive" };
  if (value.gt(MAX_AMOUNT)) return { ok: false, reason: "tooLarge" };
  return { ok: true, value };
}

export type CurrencyTotals = Record<CurrencyCode, DecimalValue>;

export function emptyTotals(): CurrencyTotals {
  return { USD: new Decimal(0), KHR: new Decimal(0) };
}

/** Sum amounts per currency. Never mixes currencies. */
export function sumByCurrency(items: ReadonlyArray<{ currency: CurrencyCode; amount: DecimalLike | string }>): CurrencyTotals {
  const totals = emptyTotals();
  for (const item of items) {
    // Construct via the exact string form: Prisma returns its own Decimal class instances.
    totals[item.currency] = totals[item.currency].plus(new Decimal(item.amount.toString()));
  }
  return totals;
}

/** Locale-aware display. Uses the Decimal's exact string, not a float conversion. */
export function formatMoney(amount: DecimalLike | string, currency: CurrencyCode, locale: AppLocale): string {
  const d = new Decimal(amount.toString());
  const fraction = currency === "USD" ? 2 : 0;
  const fmt = new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
  // Intl.NumberFormat formats numeric strings exactly (ES2023), avoiding float conversion.
  return fmt.format(d.toFixed(fraction) as `${number}`);
}

/** Serialize for JSON (audit before/after, API responses). */
export function moneyToString(amount: DecimalLike | null | undefined): string | null {
  return amount == null ? null : new Decimal(amount.toString()).toFixed(2);
}

export { Decimal };
