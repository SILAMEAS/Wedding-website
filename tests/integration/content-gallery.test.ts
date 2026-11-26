import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { deleteLocation, moveItem, saveEvent, saveLocation, updateBasics } from "@/server/services/content.service";
import { addPhotos, deletePhoto, movePhoto, saveAlbum } from "@/server/services/gallery.service";
import { storage } from "@/lib/storage";
import { attachAsset, cleanupPendingAssets, musicUrl, uploadAudio, uploadImage } from "@/server/services/media.service";
import { getInvitationContent, getPublicAlbum, getPublicAlbums, getPublicEvents } from "@/server/services/public-content.service";
import { adminCtx } from "../support/fixtures";
import { createTestPrisma, resetDatabase } from "../support/test-db";

process.env.MEDIA_STORAGE = "local";
const prisma = createTestPrisma();
let ctx: AdminContext;
// Storage paths of files written by these tests (rows are truncated between tests, so track files directly).
const createdFiles: string[] = [];

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const L = (en: string, kh = "") => ({ en, kh });

async function upload(purpose: "SITE_IMAGE" | "GALLERY_PHOTO" = "GALLERY_PHOTO", name = "photo.png") {
  const r = await uploadImage(new File([new Uint8Array(PNG)], name), purpose);
  createdFiles.push((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: r.assetId } })).publicId);
  return r.assetId;
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

afterAll(async () => {
  // Remove files written to ./.uploads by these tests.
  for (const publicId of createdFiles) await storage().remove({ publicId, deliveryType: "upload" });
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  ctx = await adminCtx(prisma);
});

describe("image uploads", () => {
  it("accepts a real image (by magic bytes, not file name) and records dimensions", async () => {
    const id = await upload("GALLERY_PHOTO", "renamed.jpg");
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
    expect(asset).toMatchObject({ format: "png", width: 1, height: 1, status: "PENDING", deliveryType: "upload" });
  });

  it("rejects non-images, SVG, empty and oversized-dimension files", async () => {
    await expectCode(uploadImage(new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "x.png"), "SITE_IMAGE"), "fileType");
    await expectCode(uploadImage(new File(["%PDF-1.4 fake"], "x.jpg"), "SITE_IMAGE"), "fileType");
    await expectCode(uploadImage(new File([], "x.png"), "SITE_IMAGE"), "invalidInput");
    const huge = Buffer.from(PNG);
    huge.writeUInt32BE(20_000, 16); // IHDR width
    huge.writeUInt32BE(20_000, 20); // IHDR height
    await expectCode(uploadImage(new File([new Uint8Array(huge)], "bomb.png"), "SITE_IMAGE"), "imageTooLarge");
    await expectCode(uploadImage(new File([new Uint8Array(11 * 1024 * 1024)], "big.png"), "SITE_IMAGE"), "fileTooLarge");
  });

  it("assets can only be attached for their own purpose", async () => {
    const id = await upload("GALLERY_PHOTO");
    await expectCode(prisma.$transaction((tx) => attachAsset(tx, id, ["SITE_IMAGE"])), "invalidInput");
  });

  it("abandoned uploads are cleaned up", async () => {
    const id = await upload();
    await prisma.mediaAsset.update({ where: { id }, data: { createdAt: new Date(Date.now() - 48 * 3600_000) } });
    expect(await cleanupPendingAssets(24)).toBe(1);
    expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id } })).status).toBe("DELETED");
  });
});

describe("background music", () => {
  // Minimal MPEG-1 Layer III frame header (sync word 0xFFFB) padded to a full frame.
  const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.from([3, 0, 0, 0, 0, 0, 0]), Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413)]);

  it("accepts mp3 by magic bytes and exposes a playable URL only once attached as MUSIC", async () => {
    const r = await uploadAudio(new File([new Uint8Array(MP3)], "song.mp3"));
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: r.assetId } });
    createdFiles.push(asset.publicId);
    expect(asset).toMatchObject({ purpose: "MUSIC", format: "mp3" });
    expect(await musicUrl(r.assetId)).toBe(`/api/media/${r.assetId}`);

    // Byte-range support (Safari needs it for <audio>)
    const { GET } = await import("@/app/api/media/[id]/route");
    const call = (range?: string) =>
      GET(new Request(`http://test/api/media/${r.assetId}`, { headers: range ? { range } : {} }), { params: Promise.resolve({ id: r.assetId }) });
    const full = await call();
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("audio/mpeg");
    const part = await call("bytes=0-9");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-9/${MP3.length}`);
    expect((await part.arrayBuffer()).byteLength).toBe(10);
    expect((await call(`bytes=${MP3.length + 5}-`)).status).toBe(416);
  });

  it("rejects non-audio files disguised as mp3", async () => {
    await expectCode(uploadAudio(new File([new Uint8Array(PNG)], "song.mp3")), "audioType");
  });
});

describe("wedding settings", () => {
  it("stores the date in Phnom Penh time and swaps the hero image, releasing the old one", async () => {
    const first = await upload("SITE_IMAGE");
    const base = { groomName: L("Sila", "សិលា"), brideName: L("Kimsour", "គឹមសួ"), invitationMessage: L(""), postWeddingMessage: L("") };
    await updateBasics(ctx, { ...base, weddingDate: "2027-01-15T17:30", heroAssetId: first, musicAssetId: null });
    const s = await prisma.weddingSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(s.weddingDate?.toISOString()).toBe("2027-01-15T10:30:00.000Z");
    expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: first } })).status).toBe("ATTACHED");

    const second = await upload("SITE_IMAGE");
    await updateBasics(ctx, { ...base, weddingDate: undefined, heroAssetId: second, musicAssetId: null });
    expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: first } })).status).toBe("DELETED");
    expect((await prisma.weddingSettings.findUniqueOrThrow({ where: { id: 1 } })).weddingDate).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "settings.update" } })).toBe(2);
  });
});

describe("venues & events", () => {
  const venue = { name: L("Sokha Hotel"), address: L("Phnom Penh"), parking: L(""), access: L(""), imageAssetId: null, status: "PUBLISHED" as const };

  it("normalizes Google Maps embeds and refuses other hosts", async () => {
    await saveLocation(ctx, { ...venue, mapEmbed: '<iframe src="https://www.google.com/maps/embed?pb=abc&amp;z=1"></iframe>' });
    expect((await prisma.weddingLocation.findFirstOrThrow()).mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=abc&z=1");
    await expectCode(saveLocation(ctx, { ...venue, mapEmbed: "https://evil.example/maps/embed" }), "invalidMapUrl");
  });

  it("only published events appear publicly, in time order, and venues used by events are archived not deleted", async () => {
    await saveLocation(ctx, venue);
    const loc = await prisma.weddingLocation.findFirstOrThrow();
    const ev = { description: L(""), dressCode: L(""), instructions: L(""), locationId: loc.id };
    await saveEvent(ctx, { ...ev, title: L("Reception"), startsAt: "2027-01-15T17:00", status: "PUBLISHED" });
    await saveEvent(ctx, { ...ev, title: L("Ceremony"), startsAt: "2027-01-15T07:00", status: "PUBLISHED" });
    await saveEvent(ctx, { ...ev, title: L("Secret rehearsal"), startsAt: "2027-01-14T07:00", status: "DRAFT" });

    const events = await getPublicEvents("en");
    expect(events.map((e) => e.title)).toEqual(["Ceremony", "Reception"]);
    expect(events[0]!.location?.name).toBe("Sokha Hotel");

    await deleteLocation(ctx, loc.id);
    expect((await prisma.weddingLocation.findUniqueOrThrow({ where: { id: loc.id } })).status).toBe("ARCHIVED");
    expect((await getPublicEvents("en"))[0]!.location).toBeNull(); // archived venue is not shown
  });

  it("falls back to the other language when a translation is missing", async () => {
    await saveLocation(ctx, { ...venue, name: { en: "", kh: "សណ្ឋាគារ សុខា" } });
    const content = await getInvitationContent("en");
    expect(content.locations[0]!.name).toBe("សណ្ឋាគារ សុខា");
  });

  it("reorders items", async () => {
    await saveLocation(ctx, { ...venue, name: L("A") });
    await saveLocation(ctx, { ...venue, name: L("B") });
    const b = await prisma.weddingLocation.findFirstOrThrow({ where: { name: { equals: L("B") } } });
    await moveItem(ctx, "weddingLocation", b.id, "up");
    const order = await prisma.weddingLocation.findMany({ orderBy: { sortOrder: "asc" } });
    expect(order.map((l) => (l.name as { en: string }).en)).toEqual(["B", "A"]);
  });
});

describe("gallery", () => {
  it("respects album visibility and hides empty albums", async () => {
    const pub = await saveAlbum(ctx, { title: L("Pre-wedding"), description: L(""), visibility: "PUBLIC" });
    const guests = await saveAlbum(ctx, { title: L("Family"), description: L(""), visibility: "INVITATION_ONLY" });
    const hidden = await saveAlbum(ctx, { title: L("Drafts"), description: L(""), visibility: "UNPUBLISHED" });
    await saveAlbum(ctx, { title: L("Empty"), description: L(""), visibility: "PUBLIC" });
    for (const id of [pub, guests, hidden]) await addPhotos(ctx, id, [await upload()]);

    expect((await getPublicAlbums("en", false)).map((a) => a.title)).toEqual(["Pre-wedding"]);
    expect((await getPublicAlbums("en", true)).map((a) => a.title)).toEqual(["Pre-wedding", "Family"]);

    const slugOf = async (id: string) => (await prisma.photoAlbum.findUniqueOrThrow({ where: { id } })).slug;
    expect(await getPublicAlbum("en", await slugOf(guests), false)).toEqual({ restricted: true });
    expect((await getPublicAlbum("en", await slugOf(guests), true))?.restricted).toBe(false);
    expect(await getPublicAlbum("en", await slugOf(hidden), true)).toBeNull();
  });

  it("generates unique slugs for albums with the same title", async () => {
    const a = await saveAlbum(ctx, { title: L("Angkor Wat"), description: L(""), visibility: "PUBLIC" });
    const b = await saveAlbum(ctx, { title: L("Angkor Wat"), description: L(""), visibility: "PUBLIC" });
    const [sa, sb] = await Promise.all([a, b].map(async (id) => (await prisma.photoAlbum.findUniqueOrThrow({ where: { id } })).slug));
    expect(sa).toBe("angkor-wat");
    expect(sb).toMatch(/^angkor-wat-[0-9a-f]{4}$/);
  });

  it("first photo becomes cover; deleting the cover moves it; ordering works", async () => {
    const album = await saveAlbum(ctx, { title: L("Album"), description: L(""), visibility: "PUBLIC" });
    await addPhotos(ctx, album, [await upload(), await upload(), await upload()]);
    const photos = await prisma.photo.findMany({ where: { albumId: album }, orderBy: { sortOrder: "asc" } });
    expect((await prisma.photoAlbum.findUniqueOrThrow({ where: { id: album } })).coverPhotoId).toBe(photos[0]!.id);

    await movePhoto(ctx, photos[2]!.id, "up");
    const reordered = await prisma.photo.findMany({ where: { albumId: album }, orderBy: { sortOrder: "asc" } });
    expect(reordered.map((p) => p.id)).toEqual([photos[0]!.id, photos[2]!.id, photos[1]!.id]);

    await deletePhoto(ctx, photos[0]!.id);
    expect((await prisma.photoAlbum.findUniqueOrThrow({ where: { id: album } })).coverPhotoId).toBe(photos[2]!.id);
    expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: photos[0]!.assetId } })).status).toBe("DELETED");
  });
});
