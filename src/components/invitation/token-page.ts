import "server-only";
import { getRequestMeta } from "@/lib/request-meta";
import { type GuardedResolution, resolveTokenGuarded } from "@/server/services/token-guard.service";

/** Shared first step for every token page: rate-limited, server-side token validation. */
export async function resolveTokenForPage(token: string): Promise<{ resolution: GuardedResolution; userAgent: string }> {
  const meta = await getRequestMeta();
  return { resolution: await resolveTokenGuarded(token, meta.ipHash), userAgent: meta.userAgent };
}
