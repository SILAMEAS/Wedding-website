import { describe, expect, it } from "vitest";
import { Decimal, formatMoney, moneyToString, parseAmount, sumByCurrency } from "@/lib/money";

describe("parseAmount", () => {
  it("accepts USD with up to 2 decimals and thousands separators", () => {
    const r = parseAmount("1,250.50", "USD");
    expect(r.ok && r.value.toFixed(2)).toBe("1250.50");
  });

  it("rejects USD with 3 decimals", () => {
    expect(parseAmount("10.555", "USD")).toEqual({ ok: false, reason: "format" });
  });

  it("requires whole riel for KHR", () => {
    expect(parseAmount("400000", "KHR").ok).toBe(true);
    expect(parseAmount("400000.5", "KHR")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects zero, negative and non-numeric input", () => {
    expect(parseAmount("0", "USD")).toEqual({ ok: false, reason: "nonPositive" });
    expect(parseAmount("-5", "USD")).toEqual({ ok: false, reason: "format" });
    expect(parseAmount("abc", "KHR")).toEqual({ ok: false, reason: "format" });
    expect(parseAmount("1e5", "USD")).toEqual({ ok: false, reason: "format" });
  });
});

describe("sumByCurrency", () => {
  it("keeps USD and KHR totals separate", () => {
    const totals = sumByCurrency([
      { currency: "USD", amount: "50.00" },
      { currency: "KHR", amount: "200000" },
      { currency: "USD", amount: "25.25" },
    ]);
    expect(totals.USD.toFixed(2)).toBe("75.25");
    expect(totals.KHR.toFixed(0)).toBe("200000");
  });

  it("does not lose precision where floating point would (0.1 + 0.2)", () => {
    const totals = sumByCurrency([
      { currency: "USD", amount: "0.10" },
      { currency: "USD", amount: "0.20" },
    ]);
    expect(totals.USD.toFixed(2)).toBe("0.30");
    expect(totals.USD.equals(new Decimal("0.3"))).toBe(true);
  });

  it("sums many cents exactly", () => {
    const items = Array.from({ length: 10_000 }, () => ({ currency: "USD" as const, amount: "0.01" }));
    expect(sumByCurrency(items).USD.toFixed(2)).toBe("100.00");
  });

  it("accepts Decimal-like objects (e.g. Prisma's server Decimal)", () => {
    const foreign = { toString: () => "12.34" };
    expect(sumByCurrency([{ currency: "USD", amount: foreign }]).USD.toFixed(2)).toBe("12.34");
  });
});

// Intl inserts non-breaking spaces; NFKC normalization turns them into regular spaces.
const plain = (s: string) => s.normalize("NFKC");

describe("formatMoney / moneyToString", () => {
  it("formats USD with 2 decimals and KHR with none", () => {
    expect(formatMoney("1250.5", "USD", "en")).toBe("US$1,250.50");
    expect(plain(formatMoney("400000", "KHR", "en"))).toBe("KHR 400,000");
  });

  it("formats large amounts exactly without float rounding", () => {
    expect(plain(formatMoney("9007199254740993", "KHR", "en"))).toBe("KHR 9,007,199,254,740,993");
  });

  it("formats in Khmer", () => {
    expect(formatMoney("400000", "KHR", "kh")).toContain("៛");
  });

  it("serializes to fixed 2-dp strings", () => {
    expect(moneyToString(new Decimal("5"))).toBe("5.00");
    expect(moneyToString(null)).toBeNull();
  });
});
