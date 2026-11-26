import "server-only";
import writeXlsxFile from "write-excel-file/node";
import type { Prisma } from "@/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { toPhnomPenhLocalInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma/client";
import { pickLocalized } from "@/lib/validation/localized";
import type { AdminContext } from "@/server/context";
import { recordAudit } from "./audit.service";

/*
 * Admin exports (CSV / Excel). Rules:
 *  - Admin only; every export is audited (financial ones included).
 *  - Filters from the list pages are respected.
 *  - Never exported: invitation tokens, internal notes, payment-evidence files,
 *    session or security data.
 *  - Money: USD and KHR in separate columns, never summed together.
 *  - Times are Phnom Penh wall-clock ("YYYY-MM-DD HH:mm").
 */

export const EXPORT_RESOURCES = ["guests", "groups", "invitations", "rsvps", "checkins", "wishes", "gifts"] as const;
export type ExportResource = (typeof EXPORT_RESOURCES)[number];
type Cell = string | number | null;
type Table = { header: string[]; rows: Cell[][] };

const when = (d: Date | null | undefined) => (d ? toPhnomPenhLocalInput(d).replace("T", " ") : null);
const name = (p: { nameEn: string | null; nameKh: string | null } | null | undefined) => (p ? [p.nameKh, p.nameEn].filter(Boolean).join(" / ") : null);
const money = (d: { toFixed(n: number): string } | null) => (d ? d.toFixed(2) : null);

export type ExportFilters = Record<string, string | undefined>;

async function guests(f: ExportFilters): Promise<Table> {
  const where: Prisma.GuestWhereInput = {
    archivedAt: f.archived === "1" ? { not: null } : null,
    ...(f.category ? { category: f.category as Prisma.EnumGuestCategoryFilter["equals"] } : {}),
    ...(f.q ? { OR: [{ nameEn: { contains: f.q, mode: "insensitive" } }, { nameKh: { contains: f.q } }] } : {}),
  };
  const rows = await prisma.guest.findMany({
    where,
    orderBy: [{ nameKh: "asc" }, { nameEn: "asc" }],
    include: { group: { select: { nameEn: true, nameKh: true } }, invitations: { where: { status: { not: "REVOKED" } }, select: { id: true } } },
  });
  return {
    header: ["Name (Khmer)", "Name (English)", "Phone", "Email", "Category", "Side", "Relationship", "Family / group", "Individual invitation"],
    rows: rows.map((g) => [g.nameKh, g.nameEn, g.phone, g.email, g.category, g.side, g.relationship, name(g.group), g.invitations.length ? "yes" : g.group ? "via family" : "no"]),
  };
}

async function groups(): Promise<Table> {
  const rows = await prisma.guestGroup.findMany({
    where: { archivedAt: null },
    orderBy: [{ nameKh: "asc" }, { nameEn: "asc" }],
    include: {
      members: { where: { archivedAt: null }, select: { nameEn: true, nameKh: true } },
      primaryContact: { select: { nameEn: true, nameKh: true } },
      invitations: { where: { status: { not: "REVOKED" } }, select: { status: true, capacity: true } },
    },
  });
  return {
    header: ["Group (Khmer)", "Group (English)", "Category", "Members", "Member names", "Primary contact", "Invitation", "Capacity"],
    rows: rows.map((g) => [g.nameKh, g.nameEn, g.category, g.members.length, g.members.map(name).join("; "), name(g.primaryContact), g.invitations[0]?.status ?? "none", g.invitations[0]?.capacity ?? null]),
  };
}

async function invitations(f: ExportFilters): Promise<Table> {
  const where: Prisma.InvitationWhereInput = {
    ...(f.type ? { type: f.type as "INDIVIDUAL" | "FAMILY" } : {}),
    ...(f.status ? { status: f.status as "ACTIVE" | "INACTIVE" | "REVOKED" } : { status: { not: "REVOKED" } }),
    ...(f.opened === "1" ? { firstOpenedAt: { not: null } } : f.opened === "0" ? { firstOpenedAt: null } : {}),
    ...(f.rsvp === "none" ? { rsvp: { is: null } } : f.rsvp ? { rsvp: { is: { status: f.rsvp as "ATTENDING" } } } : {}),
  };
  const rows = await prisma.invitation.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      guest: { select: { nameEn: true, nameKh: true } },
      group: { select: { nameEn: true, nameKh: true, _count: { select: { members: { where: { archivedAt: null } } } } } },
      rsvp: { select: { status: true, attendingCount: true } },
      checkIns: { where: { voidedAt: null }, select: { arrivedCount: true } },
    },
  });
  // Tokens are deliberately NOT exported.
  return {
    header: ["Invited", "Type", "Members", "Capacity", "Status", "Label", "Reply", "Attending", "First opened", "Checked in"],
    rows: rows.map((i) => [
      name(i.guest ?? i.group),
      i.type,
      i.type === "FAMILY" ? (i.group?._count.members ?? 0) : 1,
      i.capacity,
      i.status,
      i.internalLabel,
      i.rsvp?.status ?? "no reply",
      i.rsvp?.attendingCount ?? null,
      when(i.firstOpenedAt),
      i.checkIns.reduce((n, c) => n + c.arrivedCount, 0),
    ]),
  };
}

async function rsvps(): Promise<Table> {
  const rows = await prisma.rsvp.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      invitation: { select: { guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } } },
      participants: { include: { guest: { select: { nameEn: true, nameKh: true } } } },
    },
  });
  return {
    header: ["Invitation", "Reply", "Attending people", "Attending names", "Not attending", "Additional guests", "Dietary", "Accessibility", "Note", "Updated", "Version", "Last change by"],
    rows: rows.map((r) => [
      name(r.invitation.guest ?? r.invitation.group),
      r.status,
      r.attendingCount,
      r.participants.filter((p) => p.attending).map((p) => name(p.guest)).join("; "),
      r.participants.filter((p) => !p.attending).map((p) => name(p.guest)).join("; "),
      r.unnamedGuests,
      r.dietary,
      r.accessibility,
      r.note,
      when(r.updatedAt),
      r.version,
      r.lastActor,
    ]),
  };
}

async function checkins(): Promise<Table> {
  const rows = await prisma.guestCheckIn.findMany({ orderBy: { checkedInAt: "asc" } });
  return {
    header: ["Party", "Arrived", "Time", "Override", "Override reason", "Note", "Voided", "Void reason"],
    rows: rows.map((c) => [c.displayNameSnapshot, c.arrivedCount, when(c.checkedInAt), c.isOverride ? "yes" : "no", c.overrideReason, c.note, when(c.voidedAt), c.voidReason]),
  };
}

async function wishes(f: ExportFilters): Promise<Table> {
  const rows = await prisma.wish.findMany({
    where: f.status ? (f.status === "PRIVATE" ? { visibility: "PRIVATE" } : { status: f.status as "PENDING" }) : {},
    orderBy: { createdAt: "asc" },
  });
  return {
    header: ["From", "Relationship", "Message", "Visibility", "Status", "Sent", "Edited by couple", "Original message"],
    rows: rows.map((w) => [w.authorName, w.relationship, w.message, w.visibility, w.status, when(w.createdAt), w.originalMessage ? "yes" : "no", w.originalMessage]),
  };
}

async function gifts(f: ExportFilters, locale: "kh" | "en"): Promise<Table> {
  const where: Prisma.GiftWhereInput = {
    ...(f.status ? { status: f.status as "VERIFIED" } : {}),
    ...(f.currency ? { currency: f.currency as "USD" | "KHR" } : {}),
    ...(f.method ? { method: f.method as "CASH" } : {}),
    ...(f.q ? { OR: [{ donorName: { contains: f.q, mode: "insensitive" } }, { transactionRef: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await prisma.gift.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      invitation: { select: { guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } } },
      paymentMethod: { select: { label: true } },
    },
  });
  // Separate USD / KHR columns so a spreadsheet SUM can never mix currencies. Evidence files are never exported.
  return {
    header: ["From", "Invitation", "Status", "Method", "Account", "Received USD", "Received KHR", "Guest said USD", "Guest said KHR", "Reference", "Sent on", "Received on", "Confirmed at", "Source", "Has screenshot", "Guest message", "Your note"],
    rows: rows.map((g) => {
      const usd = g.currency === "USD";
      return [
        g.donorName,
        name(g.invitation?.guest ?? g.invitation?.group),
        g.status,
        g.method,
        g.paymentMethod ? pickLocalized(g.paymentMethod.label, locale).text : null,
        usd ? money(g.receivedAmount) : null,
        usd ? null : money(g.receivedAmount),
        usd ? money(g.notifiedAmount) : null,
        usd ? null : money(g.notifiedAmount),
        g.transactionRef,
        when(g.transferredAt),
        when(g.receivedAt),
        when(g.verifiedAt),
        g.source,
        g.evidenceAssetId ? "yes" : "no",
        g.message,
        g.adminNote,
      ];
    }),
  };
}

async function build(resource: ExportResource, f: ExportFilters, locale: "kh" | "en"): Promise<Table> {
  switch (resource) {
    case "guests": return guests(f);
    case "groups": return groups();
    case "invitations": return invitations(f);
    case "rsvps": return rsvps();
    case "checkins": return checkins();
    case "wishes": return wishes(f);
    case "gifts": return gifts(f, locale);
  }
}

const MONEY_COLUMNS = new Set(["Received USD", "Received KHR", "Guest said USD", "Guest said KHR"]);

export async function exportResource(
  ctx: AdminContext,
  resource: ExportResource,
  format: "csv" | "xlsx",
  filters: ExportFilters,
  locale: "kh" | "en",
): Promise<{ body: Uint8Array; contentType: string; filename: string; rows: number }> {
  const table = await build(resource, filters, locale);
  await recordAudit(prisma, ctx, { action: "export.download", entityType: "Export", entityId: resource, metadata: { format, rows: table.rows.length, filters } });
  const stamp = toPhnomPenhLocalInput(new Date()).slice(0, 10);
  const filename = `wedding-${resource}-${stamp}.${format}`;

  if (format === "csv") {
    return { body: new TextEncoder().encode(toCsv(table.header, table.rows)), contentType: "text/csv; charset=utf-8", filename, rows: table.rows.length };
  }
  const moneyIdx = new Set(table.header.map((h, i) => (MONEY_COLUMNS.has(h) ? i : -1)).filter((i) => i >= 0));
  const data = [
    table.header.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...table.rows.map((r) =>
      r.map((v, i) => {
        if (v === null || v === "") return null;
        // Money as numbers (2 dp, < 1e16 so exact for display) for spreadsheet SUMs.
        if (moneyIdx.has(i)) return { value: Number(v), type: Number, format: "#,##0.00" };
        return typeof v === "number" ? { value: v, type: Number } : { value: String(v), type: String };
      }),
    ),
  ];
  const buffer = await writeXlsxFile(data, { columns: table.header.map((h) => ({ width: Math.min(40, Math.max(12, h.length + 4)) })) }).toBuffer();
  return {
    body: new Uint8Array(buffer),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename,
    rows: table.rows.length,
  };
}
