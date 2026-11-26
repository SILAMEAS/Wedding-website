import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/policies/admin";
import { ImportWizard } from "./import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.import"))("title") };
}

export default async function ImportPage() {
  await requireAdmin();
  const t = await getTranslations("Admin.import");
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="mb-4 rounded-xl border border-border bg-background p-4 text-sm">
        <p className="font-medium">{t("columns")}</p>
        <code className="mt-1 block text-xs break-words text-purple-deep">{t("columnsList")}</code>
        <p className="mt-2 text-xs text-muted-foreground">{t("categoryHelp")}</p>
      </div>
      <ImportWizard />
    </>
  );
}
