import { type AppLocale, intlLocale, WEDDING_TIME_ZONE } from "@/i18n/locales";

/**
 * All instants are stored in UTC. All display and admin input is in
 * Asia/Phnom_Penh, which is a fixed UTC+07:00 (Cambodia has no DST).
 */
const PHNOM_PENH_OFFSET = "+07:00";

export function formatDate(date: Date, locale: AppLocale, options: Intl.DateTimeFormatOptions = { dateStyle: "full" }): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: WEDDING_TIME_ZONE, ...options }).format(date);
}

export function formatDateTime(date: Date, locale: AppLocale): string {
  return formatDate(date, locale, { dateStyle: "full", timeStyle: "short" });
}

export function formatTime(date: Date, locale: AppLocale): string {
  return formatDate(date, locale, { hour: "numeric", minute: "2-digit" });
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Parse an admin `<input type="datetime-local">` value ("2027-01-15T17:30"),
 * interpreted as Phnom Penh wall-clock time, into a UTC Date.
 * Returns null for malformed or impossible values (e.g. Feb 30).
 */
export function parsePhnomPenhLocal(value: string): Date | null {
  const m = LOCAL_INPUT.exec(value);
  if (!m) return null;
  const d = new Date(`${value}:00${PHNOM_PENH_OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;
  // Round-trip check rejects overflowed dates like 2027-02-30.
  return toPhnomPenhLocalInput(d) === value ? d : null;
}

/** Format a UTC Date as a Phnom Penh `datetime-local` input value. */
export function toPhnomPenhLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; isPast: boolean };

export function countdownTo(target: Date, now: Date = new Date()): CountdownParts {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    isPast: false,
  };
}
