import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultLocale } from "@/i18n/locales";
import { logger } from "@/lib/logger";
import { qrPng, qrSvg } from "@/lib/qr";
import { AppError } from "@/server/errors";
import { requireAdminOrThrow } from "@/server/policies/admin";
import { revealInvitationLink } from "@/server/services/invitation.service";

const params = z.object({ id: z.uuid() });
const formatSchema = z.enum(["png", "svg"]).catch("png");

/** Admin-only download of an invitation's QR code (encodes the personal link). Audited. */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/invitations/[id]/qr">) {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    const admin = await requireAdminOrThrow();
    const { id } = params.parse(await ctx.params);
    const format = formatSchema.parse(new URL(request.url).searchParams.get("format"));
    const { url } = await revealInvitationLink(admin, id, defaultLocale, "qr_download");
    const filename = `invitation-${id.slice(0, 8)}.${format}`;
    const disposition = `attachment; filename="${filename}"`;

    if (format === "svg") {
      return new NextResponse(await qrSvg(url), {
        headers: { ...noStore, "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": disposition },
      });
    }
    const png = await qrPng(url);
    return new NextResponse(new Uint8Array(png), {
      headers: { ...noStore, "Content-Type": "image/png", "Content-Disposition": disposition },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "unauthorized" ? 401 : error.code === "notFound" ? 404 : 409;
      return NextResponse.json({ error: error.code }, { status, headers: noStore });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: "notFound" }, { status: 404, headers: noStore });
    logger.error("qr.download_failed", { error });
    return NextResponse.json({ error: "unexpected" }, { status: 500, headers: noStore });
  }
}
