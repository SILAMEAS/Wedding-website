import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { parseLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { getSettingsForAdmin, listMilestones } from "@/server/services/content.service";
import { imageRefs } from "@/server/services/media.service";
import { MilestoneManager, StoryForm } from "./story-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.content"))("story") };
}

export default async function StoryPage() {
  const ctx = await requireAdmin();
  const [t, s, milestones] = await Promise.all([getTranslations("Admin.content"), getSettingsForAdmin(ctx), listMilestones(ctx)]);
  const images = await imageRefs([s.groomPortraitAssetId, s.bridePortraitAssetId, ...milestones.map((m) => m.imageAssetId)], 828);
  const story = (s.story ?? {}) as Record<string, unknown>;

  return (
    <>
      <PageHeader title={t("story")} description={t("storyIntro")} />
      <div className="space-y-6">
        <StoryForm
          defaults={{
            groomIntro: parseLocalized(story.groomIntro),
            brideIntro: parseLocalized(story.brideIntro),
            howWeMet: parseLocalized(story.howWeMet),
            journey: parseLocalized(story.journey),
            engagement: parseLocalized(story.engagement),
            groomPortraitAssetId: s.groomPortraitAssetId,
            bridePortraitAssetId: s.bridePortraitAssetId,
          }}
          previews={{
            groom: (s.groomPortraitAssetId && images.get(s.groomPortraitAssetId)) || null,
            bride: (s.bridePortraitAssetId && images.get(s.bridePortraitAssetId)) || null,
          }}
        />
        <MilestoneManager
          items={milestones.map((m) => ({
            id: m.id,
            occurredOn: m.occurredOn ? m.occurredOn.toISOString().slice(0, 10) : "",
            title: parseLocalized(m.title),
            body: parseLocalized(m.body),
            imageAssetId: m.imageAssetId,
            preview: (m.imageAssetId && images.get(m.imageAssetId)) || null,
            status: m.status,
          }))}
        />
      </div>
    </>
  );
}
