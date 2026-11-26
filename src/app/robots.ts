import type { MetadataRoute } from "next";

// Private family event: ask all crawlers to stay out.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
