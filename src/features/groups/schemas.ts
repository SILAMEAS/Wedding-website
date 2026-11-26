import { z } from "zod";
import { guestCategory, guestSide, optionalText, pageParam, uuid } from "@/features/shared/schemas";

const nameField = z.string().trim().max(120, { message: "tooLong" });

export const groupInputSchema = z
  .object({
    nameEn: nameField.default(""),
    nameKh: nameField.default(""),
    category: guestCategory.default("OTHER"),
    side: guestSide.optional().or(z.literal("").transform(() => undefined)),
    notes: optionalText(1000),
  })
  .refine((v) => v.nameEn.length > 0 || v.nameKh.length > 0, { path: ["nameKh"], message: "nameRequired" });
export type GroupInput = z.input<typeof groupInputSchema>;
export type GroupData = z.output<typeof groupInputSchema>;

export const addMemberSchema = z
  .object({
    groupId: uuid,
    existingGuestId: uuid.optional(),
    nameEn: nameField.default(""),
    nameKh: nameField.default(""),
    relationship: optionalText(80),
  })
  .refine((v) => v.existingGuestId || v.nameEn.length > 0 || v.nameKh.length > 0, {
    path: ["nameKh"],
    message: "nameRequired",
  });
export type AddMemberInput = z.input<typeof addMemberSchema>;

export const groupListFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  archived: z.enum(["0", "1"]).optional().catch(undefined),
  page: pageParam,
});
export type GroupListFilters = z.infer<typeof groupListFiltersSchema>;
