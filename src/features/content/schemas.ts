import { z } from "zod";
import { optionalText, uuid } from "@/features/shared/schemas";
import { isHttpsUrl, normalizeMapEmbed } from "@/lib/maps";

/** { kh, en } text pair. Messages are "Validation.*" keys. */
export const loc = (max: number) =>
  z.object({
    kh: z.string().trim().max(max, { message: "tooLong" }).default(""),
    en: z.string().trim().max(max, { message: "tooLong" }).default(""),
  });

export const locRequired = (max: number) =>
  loc(max).refine((v) => v.kh.length > 0 || v.en.length > 0, { message: "localizedRequired", path: ["kh"] });

export type LocInput = { kh: string; en: string };

const assetId = uuid.nullable().optional().transform((v) => v ?? null);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: "invalidDate" });
const optionalLocalDateTime = localDateTime.optional().or(z.literal("").transform(() => undefined));
export const PUBLISH = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const publishStatus = z.enum(PUBLISH);

// ---------------------------------------------------------------- settings

export const basicsSchema = z.object({
  groomName: locRequired(80),
  brideName: locRequired(80),
  weddingDate: optionalLocalDateTime,
  invitationMessage: loc(600),
  postWeddingMessage: loc(600),
  heroAssetId: assetId,
  musicAssetId: assetId,
});
export type BasicsInput = z.input<typeof basicsSchema>;

export const storySchema = z.object({
  groomIntro: loc(2000),
  brideIntro: loc(2000),
  howWeMet: loc(3000),
  journey: loc(3000),
  engagement: loc(3000),
  groomPortraitAssetId: assetId,
  bridePortraitAssetId: assetId,
});
export type StoryInput = z.input<typeof storySchema>;

export const SECTION_KEYS = ["story", "events", "gallery", "locations", "rsvp", "wishes", "gifts"] as const;
export const sectionsSchema = z.object(Object.fromEntries(SECTION_KEYS.map((k) => [k, z.boolean()])) as Record<(typeof SECTION_KEYS)[number], z.ZodBoolean>);
export type SectionsInput = z.infer<typeof sectionsSchema>;

export const contactSchema = z.object({
  label: locRequired(60),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,30}$/, { message: "invalidPhone" }),
  telegram: optionalText(64),
});
export const contactsSchema = z.object({ contacts: z.array(contactSchema).max(6) });
export type ContactsInput = z.input<typeof contactsSchema>;

// ---------------------------------------------------------------- story milestones

export const milestoneSchema = z.object({
  id: uuid.optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "invalidDate" }).optional().or(z.literal("").transform(() => undefined)),
  title: locRequired(120),
  body: loc(1000),
  imageAssetId: assetId,
  status: publishStatus.default("PUBLISHED"),
});
export type MilestoneInput = z.input<typeof milestoneSchema>;

// ---------------------------------------------------------------- locations

const coordinate = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(\.\d{1,6})?$/, { message: "invalidCoordinate" })
    .refine((v) => Math.abs(Number(v)) <= max, { message: "invalidCoordinate" })
    .optional()
    .or(z.literal("").transform(() => undefined));

export const locationSchema = z
  .object({
    id: uuid.optional(),
    name: locRequired(120),
    address: locRequired(400),
    mapUrl: z.string().trim().max(500).refine((v) => v === "" || isHttpsUrl(v), { message: "invalidUrl" }).optional(),
    mapEmbed: z.string().trim().max(3000).optional(),
    latitude: coordinate(90),
    longitude: coordinate(180),
    parking: loc(600),
    access: loc(600),
    imageAssetId: assetId,
    status: publishStatus.default("PUBLISHED"),
  })
  .superRefine((v, ctx) => {
    if (v.mapEmbed && !normalizeMapEmbed(v.mapEmbed)) ctx.addIssue({ code: "custom", path: ["mapEmbed"], message: "invalidMapEmbed" });
    if (!!v.latitude !== !!v.longitude) ctx.addIssue({ code: "custom", path: ["longitude"], message: "coordinatesPair" });
  });
export type LocationInput = z.input<typeof locationSchema>;

// ---------------------------------------------------------------- events

export const eventSchema = z
  .object({
    id: uuid.optional(),
    title: locRequired(120),
    description: loc(1000),
    startsAt: localDateTime,
    endsAt: optionalLocalDateTime,
    locationId: uuid.optional().or(z.literal("").transform(() => undefined)),
    dressCode: loc(200),
    instructions: loc(600),
    status: publishStatus.default("PUBLISHED"),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { path: ["endsAt"], message: "endBeforeStart" });
export type EventInput = z.input<typeof eventSchema>;

// ---------------------------------------------------------------- gallery

export const ALBUM_VISIBILITY = ["PUBLIC", "INVITATION_ONLY", "UNPUBLISHED"] as const;

export const albumSchema = z.object({
  id: uuid.optional(),
  title: locRequired(120),
  description: loc(600),
  visibility: z.enum(ALBUM_VISIBILITY).default("UNPUBLISHED"),
});
export type AlbumInput = z.input<typeof albumSchema>;

export const photoCaptionSchema = z.object({ photoId: uuid, caption: loc(300), alt: loc(200) });

export const reorderSchema = z.object({ id: uuid, direction: z.enum(["up", "down"]) });

// ---------------------------------------------------------------- guest interactions

export const guestSettingsSchema = z.object({
  rsvpDeadline: optionalLocalDateTime,
  rsvpAllowMaybe: z.boolean(),
  wishesPublicEnabled: z.boolean(),
  giftEvidenceEnabled: z.boolean(),
  giftThankYou: loc(600),
});
export type GuestSettingsInput = z.input<typeof guestSettingsSchema>;

export const CURRENCY_CODES = ["USD", "KHR"] as const;

export const paymentMethodSchema = z
  .object({
    id: uuid.optional(),
    method: z.enum(["KHQR", "BANK_TRANSFER"]),
    label: locRequired(80),
    bankName: optionalText(80),
    accountHolder: optionalText(120),
    accountNumber: z
      .string()
      .trim()
      .max(40, { message: "tooLong" })
      .regex(/^[0-9A-Za-z -]*$/, { message: "invalid" })
      .optional()
      .transform((v) => (v ? v : undefined)),
    currencies: z.array(z.enum(CURRENCY_CODES)).min(1, { message: "currencyRequired" }),
    qrAssetId: assetId,
    instructions: loc(600),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.method !== "KHQR" || !!v.qrAssetId, { path: ["qrAssetId"], message: "qrRequired" })
  .refine((v) => v.method !== "BANK_TRANSFER" || !!v.accountNumber, { path: ["accountNumber"], message: "required" });
export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;
