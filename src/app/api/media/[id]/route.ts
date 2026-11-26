import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma/client";
import { readLocalFile } from "@/lib/storage";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", mp3: "audio/mpeg", m4a: "audio/mp4" };

/**
 * Serves locally stored images (development / MEDIA_STORAGE=local only).
 * Private assets (payment evidence) are never served here.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]">) {
  if (env().MEDIA_STORAGE !== "local") return new NextResponse(null, { status: 404 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });

  const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { publicId: true, format: true, status: true, purpose: true, deliveryType: true } });
  if (!asset || asset.status === "DELETED" || asset.purpose === "GIFT_EVIDENCE" || asset.deliveryType !== "upload") {
    return new NextResponse(null, { status: 404 });
  }
  const data = await readLocalFile(asset.publicId);
  if (!data) return new NextResponse(null, { status: 404 });
  const type = MIME[asset.format] ?? "application/octet-stream";
  // Byte ranges: required by Safari for audio playback/seeking.
  const range = /^bytes=([0-9]*)-([0-9]*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = data.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
