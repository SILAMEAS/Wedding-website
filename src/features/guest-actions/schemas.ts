import { z } from "zod";
import { uuid } from "@/features/shared/schemas";

/* Guest-facing inputs (RSVP, wishes, gift notifications). Messages are "Validation.*" keys. */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .optional()
    .transform((v) => (v ? v : undefined));

export const RSVP_STATUSES = ["ATTENDING", "DECLINED", "MAYBE"] as const;

export const rsvpSchema = z.object({
  status: z.enum(RSVP_STATUSES, { message: "required" }),
  attendees: z.array(uuid).max(50).default([]),
  unnamedGuests: z.coerce.number().int().min(0).max(49).default(0),
  dietary: text(300),
  accessibility: text(300),
  note: text(500),
});
export type RsvpInput = z.input<typeof rsvpSchema>;
export type RsvpData = z.output<typeof rsvpSchema>;

export const wishSchema = z.object({
  authorName: z.string().trim().min(1, { message: "required" }).max(80, { message: "tooLong" }),
  relationship: text(80),
  message: z.string().trim().min(2, { message: "required" }).max(1000, { message: "tooLong" }),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  // Honeypot: real people never fill this hidden field.
  website: z.string().max(200).optional(),
});
export type WishInput = z.input<typeof wishSchema>;

export const GIFT_GUEST_METHODS = ["KHQR", "BANK_TRANSFER", "OTHER"] as const;

export const giftNotificationSchema = z.object({
  donorName: z.string().trim().min(1, { message: "required" }).max(120, { message: "tooLong" }),
  amount: z.string().trim().min(1, { message: "required" }).max(24, { message: "invalidAmount" }),
  currency: z.enum(["USD", "KHR"]),
  method: z.enum(GIFT_GUEST_METHODS),
  paymentMethodId: uuid.optional().or(z.literal("").transform(() => undefined)),
  transactionRef: text(80),
  transferredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "invalidDate" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  message: text(500),
  evidenceReceipt: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
});
export type GiftNotificationInput = z.input<typeof giftNotificationSchema>;
