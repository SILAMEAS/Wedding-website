import { describe, expect, it } from "vitest";
import { signGuestCookie, verifyGuestCookie } from "@/lib/auth/guest-cookie";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar";
import { directionsUrl, normalizeMapEmbed } from "@/lib/maps";

describe("map embeds", () => {
  it("accepts a Google Maps embed URL or iframe snippet", () => {
    const src = "https://www.google.com/maps/embed?pb=!1m18!1m12";
    expect(normalizeMapEmbed(src)).toBe(src);
    expect(normalizeMapEmbed(`<iframe src="${src}&amp;x=1" width="600" height="450"></iframe>`)).toBe(`${src}&x=1`);
  });

  it("rejects anything that could frame another site", () => {
    expect(normalizeMapEmbed("https://evil.example/maps/embed?pb=1")).toBeNull();
    expect(normalizeMapEmbed("http://www.google.com/maps/embed?pb=1")).toBeNull();
    expect(normalizeMapEmbed("https://www.google.com/search?q=x")).toBeNull();
    expect(normalizeMapEmbed("javascript:alert(1)")).toBeNull();
    expect(normalizeMapEmbed('<iframe src="https://www.google.com.evil.io/maps/embed"></iframe>')).toBeNull();
  });

  it("builds directions from link, coordinates or address", () => {
    expect(directionsUrl({ mapUrl: "https://maps.app.goo.gl/x", latitude: "1", longitude: "2", addressText: "a" })).toBe("https://maps.app.goo.gl/x");
    expect(directionsUrl({ mapUrl: null, latitude: "11.5564", longitude: "104.9282", addressText: "" })).toContain("destination=11.5564%2C104.9282");
    expect(directionsUrl({ mapUrl: null, latitude: null, longitude: null, addressText: "ភ្នំពេញ" })).toContain("query=");
    expect(directionsUrl({ mapUrl: null, latitude: null, longitude: null, addressText: "" })).toBeNull();
  });
});

describe("calendar", () => {
  const event = {
    id: "e1",
    title: "Wedding, reception; dinner",
    description: "Line 1\nLine 2",
    startsAt: new Date("2027-01-15T10:30:00Z"),
    endsAt: null,
    location: "Phnom Penh",
  };

  it("builds a Google Calendar link in UTC with a default 3h duration", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("dates")).toBe("20270115T103000Z/20270115T133000Z");
    expect(url.searchParams.get("ctz")).toBe("Asia/Phnom_Penh");
  });

  it("escapes and folds ICS content per RFC 5545", () => {
    const ics = buildIcs([{ ...event, title: `${event.title} ${"សិលា និង គឹមសួ ".repeat(6)}` }], "example.com", new Date("2026-01-01T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20270115T103000Z");
    expect(ics).toContain("SUMMARY:Wedding\\, reception\\; dinner");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  });
});

describe("guest cookie", () => {
  it("round-trips and rejects tampering or expiry", () => {
    const v = signGuestCookie("inv-1", "tok-1", Date.now());
    expect(verifyGuestCookie(v)).toMatchObject({ i: "inv-1", t: "tok-1" });

    const [body, sig] = v.split(".");
    const forged = Buffer.from(JSON.stringify({ i: "inv-2", t: "tok-1", e: 9_999_999_999 })).toString("base64url");
    expect(verifyGuestCookie(`${forged}.${sig}`)).toBeNull();
    expect(verifyGuestCookie(`${body}.${sig}x`)).toBeNull();
    expect(verifyGuestCookie(undefined)).toBeNull();
    expect(verifyGuestCookie(v, Date.now() + 91 * 24 * 3600 * 1000)).toBeNull();
  });
});
