import "server-only";
import { prisma } from "@/lib/prisma/client";

export const SETTINGS_ID = 1;

/** Only the fields the public landing page needs — never the whole row. */
export function findPublicBasics() {
  return prisma.weddingSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { groomName: true, brideName: true, weddingDate: true, invitationMessage: true },
  });
}
