import "server-only";
import type { AppLocale } from "@/i18n/locales";
import { pickLocalized } from "@/lib/validation/localized";
import { findPublicBasics } from "@/server/repositories/settings.repository";

export type PublicBasics = {
  groomName: string;
  brideName: string;
  weddingDate: Date | null;
  invitationMessage: string;
  configured: boolean;
};

/** Public, non-personal basics for the generic landing page. */
export async function getPublicBasics(locale: AppLocale): Promise<PublicBasics> {
  const s = await findPublicBasics();
  if (!s) {
    return { groomName: "", brideName: "", weddingDate: null, invitationMessage: "", configured: false };
  }
  return {
    groomName: pickLocalized(s.groomName, locale).text,
    brideName: pickLocalized(s.brideName, locale).text,
    weddingDate: s.weddingDate,
    invitationMessage: pickLocalized(s.invitationMessage, locale).text,
    configured: true,
  };
}
