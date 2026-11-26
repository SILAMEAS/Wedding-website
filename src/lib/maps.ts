/**
 * Map helpers. Embeds are restricted to Google Maps' embed endpoint (it is the
 * only host allowed by the CSP frame-src), so an admin cannot frame arbitrary sites.
 */
const EMBED_HOSTS = new Set(["www.google.com", "maps.google.com"]);

/** Accepts a Google Maps embed URL or the whole `<iframe …>` snippet; returns the clean src or null. */
export function normalizeMapEmbed(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  const iframeSrc = /src\s*=\s*["']([^"']+)["']/i.exec(value);
  if (iframeSrc?.[1]) value = iframeSrc[1].replace(/&amp;/g, "&");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !EMBED_HOSTS.has(url.hostname) || !url.pathname.startsWith("/maps/embed")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Best available directions link: explicit link > coordinates > address search. */
export function directionsUrl(loc: { mapUrl: string | null; latitude: string | null; longitude: string | null; addressText: string }): string | null {
  if (loc.mapUrl) return loc.mapUrl;
  if (loc.latitude && loc.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${loc.latitude},${loc.longitude}`)}`;
  }
  if (loc.addressText) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.addressText)}`;
  return null;
}
