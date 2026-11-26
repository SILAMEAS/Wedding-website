import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { readLocalFile, storage } from "@/lib/storage";
import { AppError } from "@/server/errors";
import { requireAdminOrThrow } from "@/server/policies/admin";
import { getGiftEvidence } from "@/server/services/gift-admin.service";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

/**
 * Private payment evidence, admin only. Cloudinary: short-lived signed URL
 * for the "authenticated" asset. Local dev: streamed from disk. Never cached.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/gifts/[id]/evidence">) {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    const admin = await requireAdminOrThrow();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404, headers: noStore });
    const asset = await getGiftEvidence(admin, id);

    if (env().MEDIA_STORAGE === "cloudinary") {
      return NextResponse.redirect(storage().url(asset), { status: 302, headers: noStore });
    }
    const data = await readLocalFile(asset.publicId);
    if (!data) return new NextResponse(null, { status: 404, headers: noStore });
    return new NextResponse(new Uint8Array(data), { headers: { ...noStore, "Content-Type": MIME[asset.format] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof AppError) return new NextResponse(null, { status: error.code === "unauthorized" ? 401 : 404, headers: noStore });
    throw error;
  }
}
