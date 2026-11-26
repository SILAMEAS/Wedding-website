import "server-only";
import { headers } from "next/headers";
import { hashIp } from "@/lib/security/tokens";

export type RequestMeta = { ipHash: string; userAgent: string };

/**
 * Client fingerprint for rate limiting and session listings.
 * Behind Vercel / a reverse proxy the first X-Forwarded-For entry is the client.
 * Only an HMAC of the IP is ever kept.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ipHash: hashIp(ip), userAgent: (h.get("user-agent") ?? "").slice(0, 200) };
}
