import { z } from "zod";
import { optionalText, pageParam, sortDir, uuid } from "@/features/shared/schemas";

const capacity = z.coerce.number({ message: "invalid" }).int({ message: "invalid" }).min(1, { message: "capacityMin" }).max(50, { message: "capacityMax" });
const locale = z.enum(["kh", "en"]).optional().or(z.literal("").transform(() => undefined));

const common = {
  capacity: capacity.optional(),
  allowUnnamedGuests: z.boolean().default(false),
  preferredLocale: locale,
  internalLabel: optionalText(80),
  notes: optionalText(1000),
};

export const createInvitationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INDIVIDUAL"), guestId: uuid, ...common }),
  z.object({ type: z.literal("FAMILY"), groupId: uuid, ...common }),
]);
export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

export const updateInvitationSchema = z.object({
  id: uuid,
  capacity,
  allowUnnamedGuests: z.boolean(),
  preferredLocale: locale,
  internalLabel: optionalText(80),
  notes: optionalText(1000),
  // datetime-local value in Phnom Penh time, or empty to clear
  rsvpDeadlineOverride: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: "invalidDate" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type UpdateInvitationInput = z.input<typeof updateInvitationSchema>;

export const INVITATION_STATUSES = ["ACTIVE", "INACTIVE", "REVOKED"] as const;

export const invitationListFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(["INDIVIDUAL", "FAMILY"]).optional().catch(undefined),
  status: z.enum(INVITATION_STATUSES).optional().catch(undefined),
  opened: z.enum(["0", "1"]).optional().catch(undefined),
  rsvp: z.enum(["none", "ATTENDING", "DECLINED", "MAYBE"]).optional().catch(undefined),
  sort: z.enum(["created", "capacity", "opened", "status", "type"]).optional().catch(undefined),
  dir: sortDir,
  page: pageParam,
});
export type InvitationListFilters = z.infer<typeof invitationListFiltersSchema>;
