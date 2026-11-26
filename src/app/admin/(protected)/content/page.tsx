import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { toPhnomPenhLocalInput } from "@/lib/dates";
import { parseLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { getSettingsForAdmin } from "@/server/services/content.service";
import { imageRefs, musicUrl } from "@/server/services/media.service";
import { BasicsForm, ContactsForm, GuestSettingsForm, SectionsForm } from "./content-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.content"))("title") };
}

export default async function ContentPage() {
  const ctx = await requireAdmin();
  const [t, s] = await Promise.all([getTranslations("Admin.content"), getSettingsForAdmin(ctx)]);
  const [images, music] = await Promise.all([imageRefs([s.heroAssetId], 828), musicUrl(s.musicAssetId)]);
  const sections = { story: true, events: true, gallery: true, locations: true, rsvp: true, wishes: true, gifts: true, ...((s.sectionVisibility as Record<string, boolean>) ?? {}) };
  const contacts = (Array.isArray(s.contacts) ? s.contacts : []) as { label: unknown; phone: string; telegram?: string }[];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/content/story">{t("storyLink")}</Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <BasicsForm
          defaults={{
            groomName: parseLocalized(s.groomName),
            brideName: parseLocalized(s.brideName),
            weddingDate: s.weddingDate ? toPhnomPenhLocalInput(s.weddingDate) : "",
            invitationMessage: parseLocalized(s.invitationMessage),
            postWeddingMessage: parseLocalized(s.postWeddingMessage),
            heroAssetId: s.heroAssetId,
            musicAssetId: s.musicAssetId,
          }}
          musicPreview={music}
          heroPreview={(s.heroAssetId && images.get(s.heroAssetId)) || null}
        />
        <SectionsForm defaults={{ story: !!sections.story, events: !!sections.events, gallery: !!sections.gallery, locations: !!sections.locations, rsvp: !!sections.rsvp, wishes: !!sections.wishes, gifts: !!sections.gifts }} />
        <GuestSettingsForm
          defaults={{
            rsvpDeadline: s.rsvpDeadline ? toPhnomPenhLocalInput(s.rsvpDeadline) : "",
            rsvpAllowMaybe: s.rsvpAllowMaybe,
            wishesPublicEnabled: s.wishesPublicEnabled,
            giftEvidenceEnabled: s.giftEvidenceEnabled,
            giftThankYou: parseLocalized(s.giftThankYou),
          }}
        />
        <ContactsForm defaults={contacts.map((c) => ({ label: parseLocalized(c.label), phone: c.phone, telegram: c.telegram ?? "" }))} />
      </div>
    </>
  );
}
