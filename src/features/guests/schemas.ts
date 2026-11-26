import { z } from "zod";
import { email, GUEST_CATEGORIES, guestCategory, guestSide, optionalText, pageParam, phone, sortDir, uuid } from "@/features/shared/schemas";

const nameField = z.string().trim().max(120, { message: "tooLong" });

export const guestInputSchema = z
  .object({
    nameEn: nameField.default(""),
    nameKh: nameField.default(""),
    phone,
    email,
    category: guestCategory.default("OTHER"),
    side: guestSide.optional().or(z.literal("").transform(() => undefined)),
    relationship: optionalText(80),
    groupId: uuid.optional().or(z.literal("").transform(() => undefined)),
    notes: optionalText(1000),
  })
  .refine((v) => v.nameEn.length > 0 || v.nameKh.length > 0, { path: ["nameKh"], message: "nameRequired" });
export type GuestInput = z.input<typeof guestInputSchema>;
export type GuestData = z.output<typeof guestInputSchema>;

export const guestListFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.enum(GUEST_CATEGORIES).optional().catch(undefined),
  groupId: z.union([uuid, z.literal("none")]).optional().catch(undefined),
  archived: z.enum(["0", "1"]).optional().catch(undefined),
  sort: z.enum(["name", "category", "created"]).optional().catch(undefined),
  dir: sortDir,
  page: pageParam,
});
export type GuestListFilters = z.infer<typeof guestListFiltersSchema>;

// ---------------------------------------------------------------- CSV import

export const IMPORT_COLUMNS = ["name_en", "name_kh", "phone", "email", "category", "side", "relationship", "group", "notes"] as const;
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 1_000_000;

export const importRowSchema = z
  .object({
    nameEn: nameField.default(""),
    nameKh: nameField.default(""),
    phone,
    email,
    category: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/[\s-]+/g, "_"))
      .pipe(guestCategory)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    side: z.string().trim().toUpperCase().pipe(guestSide).optional().or(z.literal("").transform(() => undefined)),
    relationship: optionalText(80),
    group: optionalText(120),
    notes: optionalText(1000),
  })
  .refine((v) => v.nameEn.length > 0 || v.nameKh.length > 0, { path: ["nameKh"], message: "nameRequired" });
export type ImportRow = z.output<typeof importRowSchema>;

export const importCommitSchema = z.object({ csv: z.string().max(IMPORT_MAX_BYTES, { message: "importTooLarge" }) });
