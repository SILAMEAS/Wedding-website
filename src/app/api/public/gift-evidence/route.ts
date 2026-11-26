import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getRequestMeta } from "@/lib/request-meta";
import { isSameOrigin } from "@/lib/security/origin";
import { AppError } from "@/server/errors";
import { evidenceReceipt, getGiftPageSettings } from "@/server/services/gift.service";
import { resolveTokenGuarded } from "@/server/services/token-guard.service";
import { uploadImage } from "@/server/services/media.service";
import { hitRateLimit, LIMITS } from "@/server/services/rate-limit.service";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * Guest payment-evidence upload (multipart: token + file). Stored PRIVATELY
 * (never publicly deliverable). Returns a receipt bound to this invitation,
 * which the gift form submits; unclaimed uploads are deleted after 24 h.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
    const meta = await getRequestMeta();
    const limit = await hitRateLimit(`upload:ip:${meta.ipHash}`, LIMITS.uploadPerIp.limit, LIMITS.uploadPerIp.windowSeconds);
    if (!limit.allowed) return NextResponse.json({ error: "rateLimited", details: { seconds: limit.retryAfterSeconds } }, { status: 429, headers: noStore });

    const form = await request.formData();
    const token = form.get("token");
    const file = form.get("file");
    if (typeof token !== "string" || !(file instanceof File)) return NextResponse.json({ error: "invalidInput" }, { status: 400, headers: noStore });

    const res = await resolveTokenGuarded(token, meta.ipHash);
    if (res.status !== "valid") return NextResponse.json({ error: "invitationInvalid" }, { status: 403, headers: noStore });
    if (!(await getGiftPageSettings("en")).evidenceEnabled) return NextResponse.json({ error: "evidenceInvalid" }, { status: 403, headers: noStore });

    const uploaded = await uploadImage(file, "GIFT_EVIDENCE");
    return NextResponse.json({ receipt: evidenceReceipt(uploaded.assetId, res.invitation.invitationId) }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.code, details: error.details }, { status: 422, headers: noStore });
    logger.error("evidence.upload_failed", { error });
    return NextResponse.json({ error: "unexpected" }, { status: 500, headers: noStore });
  }
}
