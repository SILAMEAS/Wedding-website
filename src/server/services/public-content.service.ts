import "server-only";
import type { AppLocale } from "@/i18n/locales";
import { directionsUrl } from "@/lib/maps";
import { prisma } from "@/lib/prisma/client";
import type { ImageRef } from "@/lib/storage";
import { parseLocalized, pickLocalized } from "@/lib/validation/localized";
import { imageRefs, musicUrl } from "./media.service";

/*
 * Read-only public content. Returns plain, already-localized DTOs: no private
 * fields, no internal notes, only PUBLISHED records and albums the visitor
 * may see (INVITATION_ONLY requires a valid guest cookie).
 */

export type SectionKey = "story" | "events" | "gallery" | "locations" | "rsvp" | "wishes" | "gifts";
type Sections = Record<SectionKey, boolean>;

export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  dressCode: string;
  instructions: string;
  location: { id: string; name: string; address: string; directions: string | null } | null;
};

export type PublicLocation = {
  id: string;
  name: string;
  address: string;
  image: ImageRef | null;
  mapEmbedUrl: string | null;
  directions: string | null;
  latitude: string | null;
  longitude: string | null;
  parking: string;
  access: string;
  events: { id: string; title: string; startsAt: Date }[];
};

export type PublicAlbum = { id: string; slug: string; title: string; description: string; cover: ImageRef | null; photoCount: number; invitationOnly: boolean };

const t = (v: unknown, locale: AppLocale) => pickLocalized(v, locale).text;

async function loadSettings() {
  return prisma.weddingSettings.findUnique({ where: { id: 1 } });
}

export async function getSiteBasics(locale: AppLocale) {
  const s = await loadSettings();
  const contacts = (Array.isArray(s?.contacts) ? s.contacts : []) as { label: unknown; phone: string; telegram?: string }[];
  return {
    groom: parseLocalized(s?.groomName),
    bride: parseLocalized(s?.brideName),
    groomName: t(s?.groomName, locale),
    brideName: t(s?.brideName, locale),
    weddingDate: s?.weddingDate ?? null,
    isPast: !!s?.weddingDate && s.weddingDate.getTime() < Date.now(),
    contacts: contacts.map((c) => ({ label: t(c.label, locale), phone: c.phone, telegram: c.telegram ?? null })),
  };
}

export async function getPublicLocations(locale: AppLocale): Promise<PublicLocation[]> {
  const locations = await prisma.weddingLocation.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { events: { where: { status: "PUBLISHED" }, orderBy: { startsAt: "asc" }, select: { id: true, title: true, startsAt: true } } },
  });
  const images = await imageRefs(locations.map((l) => l.imageAssetId), 1200);
  return locations.map((l) => {
    const address = t(l.address, locale);
    return {
      id: l.id,
      name: t(l.name, locale),
      address,
      image: (l.imageAssetId && images.get(l.imageAssetId)) || null,
      mapEmbedUrl: l.mapEmbedUrl,
      directions: directionsUrl({ mapUrl: l.mapUrl, latitude: l.latitude?.toString() ?? null, longitude: l.longitude?.toString() ?? null, addressText: address }),
      latitude: l.latitude?.toString() ?? null,
      longitude: l.longitude?.toString() ?? null,
      parking: t(l.parking, locale),
      access: t(l.access, locale),
      events: l.events.map((e) => ({ id: e.id, title: t(e.title, locale), startsAt: e.startsAt })),
    };
  });
}

export async function getPublicEvents(locale: AppLocale): Promise<PublicEvent[]> {
  const events = await prisma.weddingEvent.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }],
    include: { location: true },
  });
  return events.map((e) => {
    const loc = e.location && e.location.status === "PUBLISHED" ? e.location : null;
    const address = loc ? t(loc.address, locale) : "";
    return {
      id: e.id,
      title: t(e.title, locale),
      description: t(e.description, locale),
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      dressCode: t(e.dressCode, locale),
      instructions: t(e.instructions, locale),
      location: loc
        ? {
            id: loc.id,
            name: t(loc.name, locale),
            address,
            directions: directionsUrl({ mapUrl: loc.mapUrl, latitude: loc.latitude?.toString() ?? null, longitude: loc.longitude?.toString() ?? null, addressText: address }),
          }
        : null,
    };
  });
}

export async function getPublicAlbums(locale: AppLocale, invitationAccess: boolean): Promise<PublicAlbum[]> {
  const albums = await prisma.photoAlbum.findMany({
    where: { archivedAt: null, visibility: { in: invitationAccess ? ["PUBLIC", "INVITATION_ONLY"] : ["PUBLIC"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { coverPhoto: { select: { assetId: true } }, _count: { select: { photos: true } } },
  });
  const covers = await imageRefs(albums.map((a) => a.coverPhoto?.assetId), 828);
  return albums
    .filter((a) => a._count.photos > 0)
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      title: t(a.title, locale),
      description: t(a.description, locale),
      cover: (a.coverPhoto && covers.get(a.coverPhoto.assetId)) || null,
      photoCount: a._count.photos,
      invitationOnly: a.visibility === "INVITATION_ONLY",
    }));
}

export type PublicPhoto = { id: string; thumb: ImageRef; full: ImageRef; caption: string; alt: string };

export async function getPublicAlbum(locale: AppLocale, slug: string, invitationAccess: boolean) {
  const album = await prisma.photoAlbum.findUnique({
    where: { slug },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, assetId: true, caption: true, alt: true } } },
  });
  if (!album || album.archivedAt) return null;
  if (album.visibility === "UNPUBLISHED") return null;
  if (album.visibility === "INVITATION_ONLY" && !invitationAccess) return { restricted: true as const };
  const [thumbs, fulls] = await Promise.all([imageRefs(album.photos.map((p) => p.assetId), 828), imageRefs(album.photos.map((p) => p.assetId), 1920)]);
  const title = t(album.title, locale);
  return {
    restricted: false as const,
    title,
    description: t(album.description, locale),
    photos: album.photos
      .filter((p) => thumbs.has(p.assetId))
      .map((p) => ({
        id: p.id,
        thumb: thumbs.get(p.assetId)!,
        full: fulls.get(p.assetId)!,
        caption: t(p.caption, locale),
        alt: t(p.alt, locale) || t(p.caption, locale) || title,
      })) satisfies PublicPhoto[],
  };
}

/** Everything the personalized invitation page renders. */
export async function getInvitationContent(locale: AppLocale) {
  const s = await loadSettings();
  const sections: Sections = { story: true, events: true, gallery: true, locations: true, rsvp: true, wishes: true, gifts: true, ...((s?.sectionVisibility as Partial<Sections>) ?? {}) };
  const story = (s?.story ?? {}) as Record<string, unknown>;
  const milestones = await prisma.storyMilestone.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const images = await imageRefs([s?.heroAssetId, s?.groomPortraitAssetId, s?.bridePortraitAssetId, ...milestones.map((m) => m.imageAssetId)], 1920);
  const img = (id: string | null | undefined) => (id && images.get(id)) || null;

  const [events, locations, albums, basics, music] = await Promise.all([
    sections.events ? getPublicEvents(locale) : [],
    sections.locations ? getPublicLocations(locale) : [],
    sections.gallery ? getPublicAlbums(locale, true) : [],
    getSiteBasics(locale),
    musicUrl(s?.musicAssetId),
  ]);

  const storyText = {
    groomIntro: t(story.groomIntro, locale),
    brideIntro: t(story.brideIntro, locale),
    howWeMet: t(story.howWeMet, locale),
    journey: t(story.journey, locale),
    engagement: t(story.engagement, locale),
  };
  const hasStory = Object.values(storyText).some(Boolean) || milestones.length > 0;

  return {
    ...basics,
    invitationMessage: t(s?.invitationMessage, locale),
    postWeddingMessage: t(s?.postWeddingMessage, locale),
    hero: img(s?.heroAssetId),
    music,
    sections: { ...sections, story: sections.story && hasStory },
    story: { ...storyText, groomPortrait: img(s?.groomPortraitAssetId), bridePortrait: img(s?.bridePortraitAssetId) },
    milestones: milestones.map((m) => ({ id: m.id, occurredOn: m.occurredOn, title: t(m.title, locale), body: t(m.body, locale), image: img(m.imageAssetId) })),
    events,
    locations,
    albums,
  };
}
export type InvitationContent = Awaited<ReturnType<typeof getInvitationContent>>;
