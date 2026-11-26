import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { AppError } from "@/server/errors";
import { requireAdminOrThrow } from "@/server/policies/admin";
import { EXPORT_RESOURCES, exportResource } from "@/server/services/export.service";

const FILTER_KEYS = ["q", "status", "type", "category", "currency", "method", "opened", "rsvp", "archived"] as const;

/** Admin-only CSV/XLSX downloads (audited). GET /api/admin/exports/{resource}?format=csv|xlsx&…filters */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/exports/[resource]">) {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    const admin = await requireAdminOrThrow();
    const { resource } = await ctx.params;
    const parsed = z.enum(EXPORT_RESOURCES).safeParse(resource);
    if (!parsed.success) return new NextResponse(null, { status: 404, headers: noStore });
    const sp = new URL(request.url).searchParams;
    const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
    const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k)?.slice(0, 100) || undefined]));
    const locale = (await getLocale()) === "en" ? "en" : "kh";
    const file = await exportResource(admin, parsed.data, format, filters, locale);
    return new NextResponse(file.body as BodyInit, {
      headers: { ...noStore, "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.filename}"`, "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
    logger.error("export.failed", { error });
    return NextResponse.json({ error: "unexpected" }, { status: 500, headers: noStore });
  }
}
