/**
 * Expected business-rule failures. `code` is a message key under the
 * "Errors" namespace in messages/*.json so the UI can show localized text.
 * Unexpected errors are never shown to users (see toActionResult).
 */
export type ErrorCode =
  | "unexpected"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "invalidInput"
  | "rateLimited"
  | "invalidCredentials"
  | "accountLocked"
  | "wrongCurrentPassword"
  | "passwordReused"
  | "guestArchived"
  | "guestInGroup"
  | "guestHasLiveInvitation"
  | "guestIsRsvpParticipant"
  | "groupArchived"
  | "groupEmpty"
  | "groupHasLiveInvitation"
  | "invitationExists"
  | "invitationRevoked"
  | "capacityBelowAttending"
  | "capacityBelowMembers"
  | "noActiveToken"
  | "staleData"
  | "importTooLarge"
  | "importInvalid"
  | "fileTooLarge"
  | "fileType"
  | "imageTooLarge"
  | "invalidMapUrl"
  | "slugTaken"
  | "rsvpClosed"
  | "maybeNotAllowed"
  | "capacityExceeded"
  | "participantNotAllowed"
  | "noAttendees"
  | "duplicateWish"
  | "wishesClosed"
  | "invalidAmount"
  | "paymentMethodInvalid"
  | "evidenceInvalid"
  | "invitationInvalid"
  | "audioType"
  | "alreadyCheckedIn";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, string | number>,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; message?: string; meta?: unknown };
  if (e?.code !== "P2002") return false;
  if (!constraint) return true;
  return JSON.stringify(e.meta ?? {}).includes(constraint) || (e.message ?? "").includes(constraint);
}
