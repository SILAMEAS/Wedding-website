import type { Tone } from "@/components/admin/status-badge";

export const GIFT_STATUSES = ["PENDING_VERIFICATION", "VERIFIED", "REJECTED", "CANCELLED"] as const;

export const statusTone: Record<(typeof GIFT_STATUSES)[number], Tone> = {
  PENDING_VERIFICATION: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};
