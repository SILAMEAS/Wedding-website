import "server-only";
import { resolveInvitationToken, type TokenResolution } from "./invitation.service";
import { hitRateLimit, isRateLimited, LIMITS } from "./rate-limit.service";

export type GuardedResolution = TokenResolution | { status: "tooMany" };

/**
 * Every guest token lookup goes through here.
 *  - IPs that sent too many INVALID tokens are blocked for a while (enumeration defence).
 *  - Valid lookups only count toward a generous per-IP limit, so a whole wedding
 *    party on the same venue Wi-Fi is never locked out.
 */
export async function resolveTokenGuarded(token: string, ipHash: string): Promise<GuardedResolution> {
  if (await isRateLimited(`token-bad:${ipHash}`, LIMITS.invalidTokenPerIp.limit)) return { status: "tooMany" };
  const overall = await hitRateLimit(`token:${ipHash}`, LIMITS.tokenLookupPerIp.limit, LIMITS.tokenLookupPerIp.windowSeconds);
  if (!overall.allowed) return { status: "tooMany" };
  const res = await resolveInvitationToken(token);
  if (res.status === "invalid") {
    await hitRateLimit(`token-bad:${ipHash}`, LIMITS.invalidTokenPerIp.limit, LIMITS.invalidTokenPerIp.windowSeconds);
  }
  return res;
}
