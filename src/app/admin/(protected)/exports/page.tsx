import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExportButtons } from "@/components/admin/export-buttons";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/server/policies/admin";
import { EXPORT_RESOURCES } from "@/server/services/export.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.downloads"))("title") };
}

export default async function ExportsPage() {
  await requireAdmin();
  const t = await getTranslations("Admin.downloads");
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORT_RESOURCES.map((r) => (
          <Card key={r}>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg text-purple-deep">{t(`resource.${r}.title`)}</CardTitle>
              <p className="text-xs text-muted-foreground">{t(`resource.${r}.hint`)}</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <ExportButtons resource={r} />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">{t("privacyNote")}</p>
    </>
  );
}
