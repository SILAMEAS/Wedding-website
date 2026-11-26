import { describe, expect, it } from "vitest";
import { countdownTo, formatDate, parsePhnomPenhLocal, toPhnomPenhLocalInput } from "@/lib/dates";
import { htmlLang, intlLocale } from "@/i18n/locales";

describe("Phnom Penh time handling", () => {
  it("interprets admin input as UTC+7 wall-clock time", () => {
    const d = parsePhnomPenhLocal("2027-01-15T17:30");
    expect(d?.toISOString()).toBe("2027-01-15T10:30:00.000Z");
  });

  it("round-trips to the datetime-local input format", () => {
    expect(toPhnomPenhLocalInput(new Date("2027-01-15T10:30:00Z"))).toBe("2027-01-15T17:30");
    // Late UTC evening is already the next day in Phnom Penh.
    expect(toPhnomPenhLocalInput(new Date("2027-01-15T20:00:00Z"))).toBe("2027-01-16T03:00");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parsePhnomPenhLocal("2027-02-30T10:00")).toBeNull();
    expect(parsePhnomPenhLocal("2027-01-15 17:30")).toBeNull();
    expect(parsePhnomPenhLocal("")).toBeNull();
  });

  it("formats in Phnom Penh time regardless of server timezone", () => {
    const d = new Date("2027-01-15T20:00:00Z");
    expect(formatDate(d, "en", { dateStyle: "medium" })).toBe("16 Jan 2027");
  });

  it("formats Khmer with real Khmer month names (kh -> km-KH)", () => {
    const text = formatDate(new Date("2027-01-15T10:30:00Z"), "kh", { month: "long" });
    expect(text).toBe("មករា");
  });
});

describe("locale mapping", () => {
  it("maps the kh URL code to valid BCP-47 tags", () => {
    expect(intlLocale("kh")).toBe("km-KH");
    expect(htmlLang("kh")).toBe("km");
    expect(htmlLang("en")).toBe("en");
  });
});

describe("countdownTo", () => {
  it("splits the remaining time", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    const target = new Date("2027-01-02T01:02:03Z");
    expect(countdownTo(target, now)).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3, isPast: false });
  });

  it("reports past events", () => {
    expect(countdownTo(new Date(0), new Date()).isPast).toBe(true);
  });
});
