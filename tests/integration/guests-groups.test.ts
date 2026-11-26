import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { guestInputSchema } from "@/features/guests/schemas";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { addMember, archiveGroup, removeMember, setPrimaryContact } from "@/server/services/group.service";
import { commitImport, previewImport } from "@/server/services/guest-import.service";
import { archiveGuest, createGuest, listGuests, updateGuest } from "@/server/services/guest.service";
import { createFamilyInvitation, createIndividualInvitation } from "@/server/services/invitation.service";
import { adminCtx } from "../support/fixtures";
import { createTestPrisma, resetDatabase } from "../support/test-db";

const prisma = createTestPrisma();
let ctx: AdminContext;

afterAll(() => prisma.$disconnect());
beforeEach(async () => {
  await resetDatabase(prisma);
  ctx = await adminCtx(prisma);
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

const guestData = (over: Record<string, unknown> = {}) => guestInputSchema.parse({ nameKh: "សុខា", nameEn: "Sokha", ...over });

describe("guests", () => {
  it("creates, searches (Khmer and English) and audits without logging personal values", async () => {
    await createGuest(ctx, guestData({ phone: "012 111 222", category: "FRIEND" }));
    await createGuest(ctx, guestData({ nameKh: "ចាន់", nameEn: "Chan" }));
    expect((await listGuests(ctx, { q: "sok", page: 1 })).total).toBe(1);
    expect((await listGuests(ctx, { q: "ចាន់", page: 1 })).total).toBe(1);
    expect((await listGuests(ctx, { category: "FRIEND", page: 1 })).total).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { action: "guest.create" } });
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits)).not.toContain("012 111 222");
  });

  it("a guest with a live individual invitation cannot join a group or be archived", async () => {
    const g = await createGuest(ctx, guestData());
    const group = await prisma.guestGroup.create({ data: { nameEn: "Family" } });
    await createIndividualInvitation(ctx, { guestId: g.id, allowUnnamedGuests: false }, "kh");
    await expectCode(updateGuest(ctx, g.id, guestData({ groupId: group.id })), "guestHasLiveInvitation");
    await expectCode(archiveGuest(ctx, g.id), "guestHasLiveInvitation");
  });

  it("archived guests are hidden from the default list", async () => {
    const g = await createGuest(ctx, guestData());
    await archiveGuest(ctx, g.id);
    expect((await listGuests(ctx, { page: 1 })).total).toBe(0);
    expect((await listGuests(ctx, { archived: "1", page: 1 })).total).toBe(1);
  });
});

describe("groups", () => {
  it("adds new and existing members; primary contact must be a member", async () => {
    const group = await prisma.guestGroup.create({ data: { nameEn: "Chan Family", category: "BRIDE_FAMILY" } });
    const outsider = await createGuest(ctx, guestData({ nameEn: "Outsider", nameKh: "" }));
    const newId = await addMember(ctx, { groupId: group.id, nameEn: "Chan A", nameKh: "" });
    await addMember(ctx, { groupId: group.id, existingGuestId: outsider.id, nameEn: "", nameKh: "" });

    const created = await prisma.guest.findUniqueOrThrow({ where: { id: newId } });
    expect(created.category).toBe("BRIDE_FAMILY"); // inherits the group's category
    expect(await prisma.guest.count({ where: { groupId: group.id } })).toBe(2);

    const stranger = await createGuest(ctx, guestData({ nameEn: "Stranger" }));
    await expect(setPrimaryContact(ctx, group.id, stranger.id)).rejects.toThrow();
    await setPrimaryContact(ctx, group.id, newId);

    // Removing the primary contact clears the role.
    await removeMember(ctx, group.id, newId);
    expect((await prisma.guestGroup.findUniqueOrThrow({ where: { id: group.id } })).primaryContactGuestId).toBeNull();
  });

  it("a member who is an RSVP participant cannot be removed", async () => {
    const group = await prisma.guestGroup.create({ data: { nameEn: "F" } });
    const memberId = await addMember(ctx, { groupId: group.id, nameEn: "M", nameKh: "" });
    const { invitationId } = await createFamilyInvitation(ctx, { groupId: group.id, allowUnnamedGuests: false }, "kh");
    const rsvp = await prisma.rsvp.create({ data: { invitationId, status: "ATTENDING", attendingCount: 1, lastActor: "GUEST" } });
    await prisma.rsvpGuest.create({ data: { rsvpId: rsvp.id, guestId: memberId, attending: true } });
    await expectCode(removeMember(ctx, group.id, memberId), "guestIsRsvpParticipant");
  });

  it("a group with a live invitation cannot be archived", async () => {
    const group = await prisma.guestGroup.create({ data: { nameEn: "F" } });
    await addMember(ctx, { groupId: group.id, nameEn: "M", nameKh: "" });
    await createFamilyInvitation(ctx, { groupId: group.id, allowUnnamedGuests: false }, "kh");
    await expectCode(archiveGroup(ctx, group.id), "groupHasLiveInvitation");
  });
});

describe("CSV import", () => {
  const csv = [
    "name_en,name_kh,phone,category,group,relationship",
    "Sok Dara,សុខ ដារ៉ា,012 345 678,friend,,University",
    "Chan Bopha,ចាន់ បុប្ផា,,bride family,គ្រួសារ ចាន់,Aunt",
    'Chan Vichea,,,"BRIDE_FAMILY",គ្រួសារ ចាន់,"Uncle, eldest"',
  ].join("\n");

  it("previews without writing, then commits atomically and creates groups", async () => {
    const preview = await previewImport(ctx, csv);
    expect(preview.validCount).toBe(3);
    expect(preview.errorCount).toBe(0);
    expect(preview.newGroups).toEqual(["គ្រួសារ ចាន់"]);
    expect(await prisma.guest.count()).toBe(0);

    const res = await commitImport(ctx, csv);
    expect(res).toEqual({ created: 3, groupsCreated: 1 });
    const group = await prisma.guestGroup.findFirstOrThrow({ include: { members: true } });
    expect(group.nameKh).toBe("គ្រួសារ ចាន់");
    expect(group.members).toHaveLength(2);
    expect((await prisma.guest.findFirstOrThrow({ where: { nameEn: "Chan Vichea" } })).relationship).toBe("Uncle, eldest");
  });

  it("reports row errors and refuses to commit anything", async () => {
    const bad = "name_en,name_kh,email,category\n,,x@y.z,FRIEND\nOk Person,,not-an-email,FRIEND\nGood,,,FRIEND";
    const preview = await previewImport(ctx, bad);
    expect(preview.errorCount).toBe(2);
    expect(preview.rows[0]!.errors).toHaveProperty("nameKh", "nameRequired");
    expect(preview.rows[1]!.errors).toHaveProperty("email", "invalidEmail");
    await expectCode(commitImport(ctx, bad), "importInvalid");
    expect(await prisma.guest.count()).toBe(0);
  });

  it("rejects files without a name column", async () => {
    await expectCode(previewImport(ctx, "phone\n012"), "importInvalid");
  });
});
