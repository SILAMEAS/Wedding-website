import { getTranslations } from "next-intl/server";
import { Ornament } from "@/components/wedding/ornament";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  const tc = await getTranslations("Common");
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-ivory px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl text-purple-deep">{t("title")}</h1>
        <Ornament className="my-5" />
        <p className="text-muted-foreground">{t("description")}</p>
        <Link href="/" className="mt-8 inline-block text-primary underline underline-offset-4">
          {tc("backHome")}
        </Link>
      </div>
    </main>
  );
}
