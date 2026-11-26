import "server-only";
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, type ImportRow, importRowSchema } from "@/features/guests/schemas";
import { parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";

export type PreviewRow = { line: number; data?: ImportRow; errors?: Record<string, string> };
export type ImportPreview = {
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
  newGroups: string[];
  existingGroups: string[];
  unknownColumns: string[];
};

// Khmer Unicode block U+1780–U+17FF.
const KHMER_CHAR = new RegExp(`[${String.fromCharCode(0x1780)}-${String.fromCharCode(0x17ff)}]`);

const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = {
  name_en: "name_en", english_name: "name_en", "name (en)": "name_en",
  name_kh: "name_kh", khmer_name: "name_kh", "name (kh)": "name_kh",
  phone: "phone", email: "email", category: "category", side: "side",
  relationship: "relationship", group: "group", family: "group", notes: "notes",
};

/** Parse + validate without writing anything. Same function backs preview and commit. */
export async function previewImport(_ctx: AdminContext, csv: string): Promise<ImportPreview> {
  const table = parseCsv(csv);
  if (table.length < 2) throw new AppError("importInvalid");
  if (table.length - 1 > IMPORT_MAX_ROWS) throw new AppError("importTooLarge", { max: IMPORT_MAX_ROWS });

  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const columns = header.map((h) => HEADER_ALIASES[h]);
  if (!columns.includes("name_en") && !columns.includes("name_kh")) throw new AppError("importInvalid");
  const unknownColumns = header.filter((_, i) => !columns[i]);

  const rows: PreviewRow[] = table.slice(1).map((cells, idx) => {
    const raw: Record<string, string> = {};
    columns.forEach((col, i) => {
      if (col) raw[col] = cells[i] ?? "";
    });
    const parsed = importRowSchema.safeParse({
      nameEn: raw.name_en ?? "",
      nameKh: raw.name_kh ?? "",
      phone: raw.phone ?? "",
      email: raw.email ?? "",
      category: raw.category ?? "",
      side: raw.side ?? "",
      relationship: raw.relationship ?? "",
      group: raw.group ?? "",
      notes: raw.notes ?? "",
    });
    if (parsed.success) return { line: idx + 2, data: parsed.data };
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_row")] ??= issue.message;
    return { line: idx + 2, errors };
  });

  const groupNames = [...new Set(rows.map((r) => r.data?.group).filter((g): g is string => !!g))];
  const existing = groupNames.length
    ? await prisma.guestGroup.findMany({
        where: { archivedAt: null, OR: [{ nameEn: { in: groupNames } }, { nameKh: { in: groupNames } }] },
        select: { nameEn: true, nameKh: true },
      })
    : [];
  const existingNames = new Set(existing.flatMap((g) => [g.nameEn, g.nameKh]).filter(Boolean) as string[]);

  return {
    rows,
    validCount: rows.filter((r) => r.data).length,
    errorCount: rows.filter((r) => r.errors).length,
    newGroups: groupNames.filter((g) => !existingNames.has(g)),
    existingGroups: groupNames.filter((g) => existingNames.has(g)),
    unknownColumns,
  };
}

/** All-or-nothing: refuses to import if any row is invalid. */
export async function commitImport(ctx: AdminContext, csv: string): Promise<{ created: number; groupsCreated: number }> {
  const preview = await previewImport(ctx, csv);
  if (preview.errorCount > 0) throw new AppError("importInvalid");

  return prisma.$transaction(
    async (tx) => {
      const groupIds = new Map<string, string>();
      let groupsCreated = 0;
      for (const row of preview.rows) {
        const name = row.data!.group;
        if (!name || groupIds.has(name)) continue;
        const found = await tx.guestGroup.findFirst({
          where: { archivedAt: null, OR: [{ nameEn: name }, { nameKh: name }] },
          select: { id: true },
        });
        if (found) {
          groupIds.set(name, found.id);
        } else {
          const isKhmer = KHMER_CHAR.test(name);
          const g = await tx.guestGroup.create({
            data: {
              nameEn: isKhmer ? null : name,
              nameKh: isKhmer ? name : null,
              category: row.data!.category ?? "OTHER",
              side: row.data!.side ?? null,
            },
          });
          groupIds.set(name, g.id);
          groupsCreated++;
        }
      }

      const result = await tx.guest.createMany({
        data: preview.rows.map(({ data: d }) => ({
          nameEn: d!.nameEn || null,
          nameKh: d!.nameKh || null,
          phone: d!.phone ?? null,
          email: d!.email ?? null,
          category: d!.category ?? "OTHER",
          side: d!.side ?? null,
          relationship: d!.relationship ?? null,
          notes: d!.notes ?? null,
          groupId: d!.group ? groupIds.get(d!.group)! : null,
        })),
      });
      await recordAudit(tx, ctx, { action: "guest.import", entityType: "Guest", metadata: { created: result.count, groupsCreated } });
      return { created: result.count, groupsCreated };
    },
    { timeout: 30_000 },
  );
}
