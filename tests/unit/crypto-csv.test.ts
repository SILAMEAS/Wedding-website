import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "@/lib/csv";
import { decryptSecret, encryptSecret, generateToken, hmacSha256, isWellFormedToken, safeEqual } from "@/lib/security/crypto";

const key = randomBytes(32).toString("base64");

describe("invitation token crypto", () => {
  it("generates 256-bit url-safe tokens that are unique", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) expect(isWellFormedToken(t)).toBe(true);
  });

  it("rejects malformed tokens before any lookup", () => {
    expect(isWellFormedToken("abc")).toBe(false);
    expect(isWellFormedToken(`${generateToken()}x`)).toBe(false);
    expect(isWellFormedToken("../".repeat(15))).toBe(false);
  });

  it("encrypts and decrypts; each encryption uses a fresh IV", () => {
    const token = generateToken();
    const a = encryptSecret(token, key);
    const b = encryptSecret(token, key);
    expect(a).not.toBe(b);
    expect(a).not.toContain(token);
    expect(decryptSecret(a, key)).toBe(token);
  });

  it("detects tampering and wrong keys (AES-GCM authentication)", () => {
    const payload = encryptSecret(generateToken(), key);
    const parts = payload.split(".");
    const ct = Buffer.from(parts[3]!, "base64url");
    ct[0] = ct[0]! ^ 0xff;
    const tampered = [parts[0], parts[1], parts[2], ct.toString("base64url")].join(".");
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(payload, randomBytes(32).toString("base64"))).toThrow();
  });

  it("keyed hashing depends on the pepper", () => {
    expect(hmacSha256("pepper-a", "t")).not.toBe(hmacSha256("pepper-b", "t"));
    expect(hmacSha256("pepper-a", "t")).toBe(hmacSha256("pepper-a", "t"));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("CSV", () => {
  it("parses quotes, escaped quotes, commas, CRLF, BOM and Khmer text", () => {
    const bom = String.fromCharCode(0xfeff);
    const text = `${bom}name,note\r\n"Sok, Dara","He said ""hi"""\r\nចាន់,\r\n\r\n`;
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Sok, Dara", 'He said "hi"'],
      ["ចាន់", ""],
    ]);
  });

  it("neutralizes spreadsheet formula injection on export", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+855 12 345 678")).toBe("'+855 12 345 678");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("normal")).toBe("normal");
  });

  it("round-trips through toCsv/parseCsv", () => {
    const out = toCsv(["a", "b"], [["x,y", 'q"q'], ["សួស្តី", null]]);
    expect(parseCsv(out)).toEqual([["a", "b"], ["x,y", 'q"q'], ["សួស្តី", ""]]);
  });
});
