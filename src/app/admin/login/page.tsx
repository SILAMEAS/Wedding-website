import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AdminLanguageSwitcher } from "@/components/admin/admin-language-switcher";
import { Ornament } from "@/components/wedding/ornament";
import { getAdminContext } from "@/server/policies/admin";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  if (await getAdminContext()) redirect("/admin/dashboard");
  const t = await getTranslations("Admin.login");
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-ivory to-lavender px-4 py-12">
      <div className="absolute top-4 right-4">
        <AdminLanguageSwitcher />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 shadow-sm">
        <h1 className="text-center font-serif text-3xl text-purple-deep">{t("title")}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{t("subtitle")}</p>
        <Ornament className="my-6" />
        <LoginForm />
      </div>
    </main>
  );
}
