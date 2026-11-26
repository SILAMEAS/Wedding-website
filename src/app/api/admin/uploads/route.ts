import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { isSameOrigin } from "@/lib/security/origin";
import { AppError } from "@/server/errors";
import { requireAdminOrThrow } from "@/server/policies/admin";
import { uploadAudio, uploadImage } from "@/server/services/media.service";

const purposeSchema = z.enum(["GALLERY_PHOTO", "SITE_IMAGE", "KHQR_IMAGE", "MUSIC"]);
const noStore = { "Cache-Control": "private, no-store" };

/** Admin image upload (multipart: file + purpose). Returns a PENDING asset id. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
    await requireAdminOrThrow();
    const form = await request.formData();
    const file = form.get("file");
    const purpose = purposeSchema.safeParse(form.get("purpose"));
    if (!(file instanceof File) || !purpose.success) {
      return NextResponse.json({ error: "invalidInput" }, { status: 400, headers: noStore });
    }
    if (purpose.data === "MUSIC") {
      const audio = await uploadAudio(file);
      return NextResponse.json({ assetId: audio.assetId, preview: { src: audio.url, width: null, height: null } }, { status: 201, headers: noStore });
    }
    const uploaded = await uploadImage(file, purpose.data);
    return NextResponse.json(uploaded, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "unauthorized" ? 401 : 422;
      return NextResponse.json({ error: error.code, details: error.details }, { status, headers: noStore });
    }
    logger.error("upload.failed", { error });
    return NextResponse.json({ error: "unexpected" }, { status: 500, headers: noStore });
  }
}
