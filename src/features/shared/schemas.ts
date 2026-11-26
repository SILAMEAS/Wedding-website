import { z } from "zod";

/**
 * Shared field schemas. Error messages are message KEYS in the "Validation"
 * namespace (messages/*.json) so client forms and server actions show the
 * same localized text.
 */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .optional()
    .transform((v) => (v ? v : undefined));

export const uuid = z.uuid({ message: "invalid" });

export const pageParam = z.coerce.number().int().min(1).max(10_000).catch(1);

export const GUEST_CATEGORIES = ["GROOM_FAMILY", "BRIDE_FAMILY", "FRIEND", "COLLEAGUE", "VIP", "OTHER"] as const;
export const GUEST_SIDES = ["GROOM", "BRIDE", "BOTH"] as const;

export const guestCategory = z.enum(GUEST_CATEGORIES, { message: "invalid" });
export const guestSide = z.enum(GUEST_SIDES, { message: "invalid" });

/** Cambodian and international phone numbers: digits, spaces, +, -, parentheses. */
export const phone = z
  .string()
  .trim()
  .max(30, { message: "tooLong" })
  .regex(/^\+?[0-9 ()-]{6,30}$/, { message: "invalidPhone" })
  .optional()
  .or(z.literal("").transform(() => undefined));

export const email = z
  .string()
  .trim()
  .max(200, { message: "tooLong" })
  .email({ message: "invalidEmail" })
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Sort direction from the URL (defaults to the column's natural order). */
export const sortDir = z.enum(["asc", "desc"]).optional().catch(undefined);
