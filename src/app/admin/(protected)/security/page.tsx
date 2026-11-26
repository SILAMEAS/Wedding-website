import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import { requireAdmin } from "@/server/policies/admin";
import { listSessions } from "@/server/services/auth.service";
import { ChangePasswordForm, SessionList } from "./security-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.security"))("title") };
}

function describeAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export default async function SecurityPage() {
  const ctx = await requireAdmin();
  const [t, locale, sessions] = await Promise.all([getTranslations("Admin.security"), getLocale() as Promise<AppLocale>, listSessions(ctx)]);
  const fmt = (d: Date) => formatDate(d, locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader title={t("title")} description={t("sharedAccount")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordForm />
        <SessionList
          sessions={sessions.map((s) => ({
            id: s.id,
            device: describeAgent(s.userAgent),
            lastSeen: fmt(s.lastSeenAt),
            signedIn: fmt(s.createdAt),
            isCurrent: s.isCurrent,
          }))}
        />
      </div>
    </>
  );
}
