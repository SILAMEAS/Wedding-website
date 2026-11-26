import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PublishStatus } from "@/generated/prisma/enums";
import type {
  BasicsInput,
  ContactsInput,
  EventInput,
  SectionsInput,
} from "@/features/content/schemas";
import { parsePhnomPenhLocal } from "@/lib/dates";
import { normalizeMapEmbed } from "@/lib/maps";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext, Db } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { attachAsset, releaseAsset } from "./media.service";

/*
 * Admin-managed wedding content. Inputs arrive already validated by Zod
 * (features/content/schemas.ts). Images are attached here and the replaced
 * image is released after the transaction commits.
 */

const SETTINGS_ID = 1;
type Loc = { kh: string; en: string };
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function ensureSettings(tx: Db) {
  return tx.weddingSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, groomName: { kh: "", en: "" }, brideName: { kh: "", en: "" } },
  });
}

export async function getSettingsForAdmin(_ctx: AdminContext) {
  return prisma.$transaction((tx) => ensureSettings(tx));
}

/** Swap an image field: attach the new asset, return the old one for release. */
async function swapImage(tx: Db, oldId: string | null, newId: string | null, purpose: "SITE_IMAGE" | "MUSIC"): Promise<string | null> {
  if (newId === oldId) return null;
  if (newId) await attachAsset(tx, newId, [purpose]);
  return oldId;
}

type BasicsData = Omit<BasicsInput, "weddingDate"> & {
  weddingDate?: string;
  groomName: Loc;
  brideName: Loc;
  invitationMessage: Loc;
  postWeddingMessage: Loc;
  heroAssetId: string | null;
  musicAssetId: string | null;
};

export async function updateBasics(ctx: AdminContext, input: BasicsData) {
  const weddingDate = input.weddingDate ? parsePhnomPenhLocal(input.weddingDate) : null;
  if (input.weddingDate && !weddingDate) throw new AppError("invalidInput");
  const released = await prisma.$transaction(async (tx) => {
    const before = await ensureSettings(tx);
    const old = await swapImage(tx, before.heroAssetId, input.heroAssetId, "SITE_IMAGE");
    const oldMusic = await swapImage(tx, before.musicAssetId, input.musicAssetId, "MUSIC");
    await tx.weddingSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        groomName: json(input.groomName),
        brideName: json(input.brideName),
        weddingDate,
        invitationMessage: json(input.invitationMessage),
        postWeddingMessage: json(input.postWeddingMessage),
        heroAssetId: input.heroAssetId,
        musicAssetId: input.musicAssetId,
        updatedById: ctx.adminUserId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "settings.update",
      entityType: "WeddingSettings",
      entityId: "1",
      metadata: { section: "basics", weddingDateFrom: before.weddingDate?.toISOString() ?? null, weddingDateTo: weddingDate?.toISOString() ?? null },
    });
    return [old, oldMusic];
  });
  for (const id of released) await releaseAsset(id);
}

type StoryData = { [K in "groomIntro" | "brideIntro" | "howWeMet" | "journey" | "engagement"]: Loc } & {
  groomPortraitAssetId: string | null;
  bridePortraitAssetId: string | null;
};

export async function updateStory(ctx: AdminContext, input: StoryData) {
  const released = await prisma.$transaction(async (tx) => {
    const before = await ensureSettings(tx);
    const oldGroom = await swapImage(tx, before.groomPortraitAssetId, input.groomPortraitAssetId, "SITE_IMAGE");
    const oldBride = await swapImage(tx, before.bridePortraitAssetId, input.bridePortraitAssetId, "SITE_IMAGE");
    const { groomPortraitAssetId, bridePortraitAssetId, ...story } = input;
    await tx.weddingSettings.update({
      where: { id: SETTINGS_ID },
      data: { story: json(story), groomPortraitAssetId, bridePortraitAssetId, updatedById: ctx.adminUserId },
    });
    await recordAudit(tx, ctx, { action: "settings.update", entityType: "WeddingSettings", entityId: "1", metadata: { section: "story" } });
    return [oldGroom, oldBride];
  });
  for (const id of released) await releaseAsset(id);
}

export async function updateSections(ctx: AdminContext, input: SectionsInput) {
  await prisma.$transaction(async (tx) => {
    const before = await ensureSettings(tx);
    const merged = { ...((before.sectionVisibility as Record<string, boolean>) ?? {}), ...input };
    await tx.weddingSettings.update({ where: { id: SETTINGS_ID }, data: { sectionVisibility: merged, updatedById: ctx.adminUserId } });
    await recordAudit(tx, ctx, { action: "settings.update", entityType: "WeddingSettings", entityId: "1", metadata: { section: "visibility", ...input } });
  });
}

export async function updateContacts(ctx: AdminContext, input: { contacts: { label: Loc; phone: string; telegram?: string }[] }) {
  await prisma.$transaction(async (tx) => {
    await ensureSettings(tx);
    await tx.weddingSettings.update({ where: { id: SETTINGS_ID }, data: { contacts: json(input.contacts), updatedById: ctx.adminUserId } });
    await recordAudit(tx, ctx, { action: "settings.update", entityType: "WeddingSettings", entityId: "1", metadata: { section: "contacts", count: input.contacts.length } });
  });
}
export type { ContactsInput };

// ------------------------------------------------------------- ordering

type Orderable = "storyMilestone" | "weddingLocation" | "weddingEvent" | "photoAlbum";

/** Swap sortOrder with the neighbour above/below (stable, transaction-safe). */
export async function moveItem(ctx: AdminContext, model: Orderable, id: string, direction: "up" | "down") {
  await prisma.$transaction(async (tx) => {
    // Normalize order first so swaps are always well-defined.
    const delegate = tx[model] as unknown as {
      findMany(args: object): Promise<{ id: string; sortOrder: number }[]>;
      update(args: object): Promise<unknown>;
    };
    const items = await delegate.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, sortOrder: true } });
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) throw new AppError("notFound");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const order = items.map((i) => i.id);
    [order[index], order[target]] = [order[target]!, order[index]!];
    for (let i = 0; i < order.length; i++) {
      if (items.find((x) => x.id === order[i])!.sortOrder !== i) await delegate.update({ where: { id: order[i] }, data: { sortOrder: i } });
    }
    await recordAudit(tx, ctx, { action: "content.reorder", entityType: model, entityId: id, metadata: { direction } });
  });
}

async function nextSortOrder(model: Orderable): Promise<number> {
  const delegate = prisma[model] as unknown as { aggregate(args: object): Promise<{ _max: { sortOrder: number | null } }> };
  const agg = await delegate.aggregate({ _max: { sortOrder: true } });
  return (agg._max.sortOrder ?? -1) + 1;
}

// ------------------------------------------------------------- milestones

type MilestoneData = { id?: string; occurredOn?: string; title: Loc; body: Loc; imageAssetId: string | null; status: PublishStatus };

export async function listMilestones(_ctx: AdminContext) {
  return prisma.storyMilestone.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function saveMilestone(ctx: AdminContext, input: MilestoneData) {
  const data = {
    occurredOn: input.occurredOn ? new Date(`${input.occurredOn}T00:00:00Z`) : null,
    title: json(input.title),
    body: json(input.body),
    imageAssetId: input.imageAssetId,
    status: input.status,
  };
  const released = await prisma.$transaction(async (tx) => {
    if (input.id) {
      const before = await tx.storyMilestone.findUnique({ where: { id: input.id } });
      if (!before) throw new AppError("notFound");
      const old = await swapImage(tx, before.imageAssetId, input.imageAssetId, "SITE_IMAGE");
      await tx.storyMilestone.update({ where: { id: input.id }, data });
      await recordAudit(tx, ctx, { action: "content.update", entityType: "StoryMilestone", entityId: input.id });
      return old;
    }
    if (input.imageAssetId) await attachAsset(tx, input.imageAssetId, ["SITE_IMAGE"]);
    const created = await tx.storyMilestone.create({ data: { ...data, sortOrder: await nextSortOrder("storyMilestone") } });
    await recordAudit(tx, ctx, { action: "content.create", entityType: "StoryMilestone", entityId: created.id });
    return null;
  });
  await releaseAsset(released);
}

export async function deleteMilestone(ctx: AdminContext, id: string) {
  const released = await prisma.$transaction(async (tx) => {
    const m = await tx.storyMilestone.findUnique({ where: { id } });
    if (!m) throw new AppError("notFound");
    await tx.storyMilestone.delete({ where: { id } });
    await recordAudit(tx, ctx, { action: "content.delete", entityType: "StoryMilestone", entityId: id });
    return m.imageAssetId;
  });
  await releaseAsset(released);
}

// ------------------------------------------------------------- locations

type LocationData = {
  id?: string;
  name: Loc;
  address: Loc;
  mapUrl?: string;
  mapEmbed?: string;
  latitude?: string;
  longitude?: string;
  parking: Loc;
  access: Loc;
  imageAssetId: string | null;
  status: PublishStatus;
};

export async function listLocations(_ctx: AdminContext) {
  return prisma.weddingLocation.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { events: true } } },
  });
}

export async function saveLocation(ctx: AdminContext, input: LocationData) {
  const data = {
    name: json(input.name),
    address: json(input.address),
    mapUrl: input.mapUrl || null,
    mapEmbedUrl: input.mapEmbed ? normalizeMapEmbed(input.mapEmbed) : null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    parking: json(input.parking),
    access: json(input.access),
    imageAssetId: input.imageAssetId,
    status: input.status,
  };
  if (input.mapEmbed && !data.mapEmbedUrl) throw new AppError("invalidMapUrl");
  const released = await prisma.$transaction(async (tx) => {
    if (input.id) {
      const before = await tx.weddingLocation.findUnique({ where: { id: input.id } });
      if (!before) throw new AppError("notFound");
      const old = await swapImage(tx, before.imageAssetId, input.imageAssetId, "SITE_IMAGE");
      await tx.weddingLocation.update({ where: { id: input.id }, data });
      await recordAudit(tx, ctx, { action: "content.update", entityType: "WeddingLocation", entityId: input.id });
      return old;
    }
    if (input.imageAssetId) await attachAsset(tx, input.imageAssetId, ["SITE_IMAGE"]);
    const created = await tx.weddingLocation.create({ data: { ...data, sortOrder: await nextSortOrder("weddingLocation") } });
    await recordAudit(tx, ctx, { action: "content.create", entityType: "WeddingLocation", entityId: created.id });
    return null;
  });
  await releaseAsset(released);
}

/** Venues used by events are archived, not deleted (events keep their reference). */
export async function deleteLocation(ctx: AdminContext, id: string) {
  const released = await prisma.$transaction(async (tx) => {
    const l = await tx.weddingLocation.findUnique({ where: { id }, include: { _count: { select: { events: true } } } });
    if (!l) throw new AppError("notFound");
    if (l._count.events > 0) {
      await tx.weddingLocation.update({ where: { id }, data: { status: "ARCHIVED" } });
      await recordAudit(tx, ctx, { action: "content.archive", entityType: "WeddingLocation", entityId: id });
      return null;
    }
    await tx.weddingLocation.delete({ where: { id } });
    await recordAudit(tx, ctx, { action: "content.delete", entityType: "WeddingLocation", entityId: id });
    return l.imageAssetId;
  });
  await releaseAsset(released);
}

// ------------------------------------------------------------- events

type EventData = Omit<EventInput, "title" | "description" | "dressCode" | "instructions" | "status"> & {
  title: Loc;
  description: Loc;
  dressCode: Loc;
  instructions: Loc;
  status: PublishStatus;
};

export async function listEvents(_ctx: AdminContext) {
  return prisma.weddingEvent.findMany({
    orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }],
    include: { location: { select: { id: true, name: true } } },
  });
}

export async function saveEvent(ctx: AdminContext, input: EventData) {
  const startsAt = parsePhnomPenhLocal(input.startsAt);
  const endsAt = input.endsAt ? parsePhnomPenhLocal(input.endsAt) : null;
  if (!startsAt || (input.endsAt && !endsAt)) throw new AppError("invalidInput");
  if (input.locationId && !(await prisma.weddingLocation.findUnique({ where: { id: input.locationId }, select: { id: true } }))) {
    throw new AppError("notFound");
  }
  const data = {
    title: json(input.title),
    description: json(input.description),
    startsAt,
    endsAt,
    locationId: input.locationId ?? null,
    dressCode: json(input.dressCode),
    instructions: json(input.instructions),
    status: input.status,
  };
  await prisma.$transaction(async (tx) => {
    if (input.id) {
      const res = await tx.weddingEvent.updateMany({ where: { id: input.id }, data });
      if (res.count === 0) throw new AppError("notFound");
      await recordAudit(tx, ctx, { action: "content.update", entityType: "WeddingEvent", entityId: input.id });
    } else {
      const created = await tx.weddingEvent.create({ data: { ...data, sortOrder: await nextSortOrder("weddingEvent") } });
      await recordAudit(tx, ctx, { action: "content.create", entityType: "WeddingEvent", entityId: created.id });
    }
  });
}

export async function deleteEvent(ctx: AdminContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.weddingEvent.deleteMany({ where: { id } });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "content.delete", entityType: "WeddingEvent", entityId: id });
  });
}

// ------------------------------------------------------------- guest interactions

export async function updateGuestSettings(
  ctx: AdminContext,
  input: { rsvpDeadline?: string; rsvpAllowMaybe: boolean; wishesPublicEnabled: boolean; giftEvidenceEnabled: boolean; giftThankYou: Loc },
) {
  const rsvpDeadline = input.rsvpDeadline ? parsePhnomPenhLocal(input.rsvpDeadline) : null;
  if (input.rsvpDeadline && !rsvpDeadline) throw new AppError("invalidInput");
  await prisma.$transaction(async (tx) => {
    await ensureSettings(tx);
    await tx.weddingSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        rsvpDeadline,
        rsvpAllowMaybe: input.rsvpAllowMaybe,
        wishesPublicEnabled: input.wishesPublicEnabled,
        giftEvidenceEnabled: input.giftEvidenceEnabled,
        giftThankYou: json(input.giftThankYou),
        updatedById: ctx.adminUserId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "settings.update",
      entityType: "WeddingSettings",
      entityId: "1",
      metadata: { section: "guestInteractions", rsvpDeadline: rsvpDeadline?.toISOString() ?? null, rsvpAllowMaybe: input.rsvpAllowMaybe },
    });
  });
}
