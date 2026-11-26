"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Shown for unexpected server/render errors. Never displays error details to guests
// (in production, server errors only carry an opaque digest anyway).
export default function PublicError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("Error");
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-ivory px-6">
      <div className="max-w-md text-center" role="alert">
        <h1 className="font-serif text-3xl text-purple-deep">{t("title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("description")}</p>
        <Button className="mt-8" onClick={() => retry()}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
