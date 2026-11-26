import type { AdminRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** Authenticated admin, resolved server-side from the session cookie. Passed explicitly into services. */
export type AdminContext = {
  adminUserId: string;
  sessionId: string;
  role: AdminRole;
  displayName: string;
  ipHash: string | null;
};

/** Either the root client or an interactive-transaction client. */
export type Db = Prisma.TransactionClient;
