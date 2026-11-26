import { describe, expect, it } from "vitest";
import {
  isLocalizedEmpty,
  localizedText,
  missingLocales,
  parseLocalized,
  pickLocalized,
  requiredLocalizedText,
} from "@/lib/validation/localized";

describe("localized content", () => {
  it("picks the requested language", () => {
    expect(pickLocalized({ en: "Hello", kh: "សួស្តី" }, "kh")).toEqual({ text: "សួស្តី", isFallback: false, lang: "kh" });
  });

  it("falls back to the other language when blank", () => {
    expect(pickLocalized({ en: "Hello", kh: "  " }, "kh")).toEqual({ text: "Hello", isFallback: true, lang: "en" });
  });

  it("tolerates malformed stored JSON", () => {
    expect(parseLocalized(null)).toEqual({ en: "", kh: "" });
    expect(parseLocalized("oops")).toEqual({ en: "", kh: "" });
    expect(parseLocalized({ en: 5, kh: "ok" })).toEqual({ en: "", kh: "ok" });
  });

  it("validates writes: trims, length-limits, requires one language when required", () => {
    expect(localizedText(5).parse({ en: "  hi  " })).toEqual({ en: "hi", kh: "" });
    expect(localizedText(5).safeParse({ en: "toolong" }).success).toBe(false);
    expect(requiredLocalizedText().safeParse({ en: "", kh: "" }).success).toBe(false);
    expect(requiredLocalizedText().safeParse({ en: "", kh: "មាស សិលា" }).success).toBe(true);
  });

  it("reports missing translations", () => {
    expect(missingLocales({ en: "Hi", kh: "" })).toEqual(["kh"]);
    expect(missingLocales({ en: "", kh: "" })).toEqual([]);
    expect(isLocalizedEmpty({ en: " ", kh: "" })).toBe(true);
  });
});
