import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Ornament } from "@/components/wedding/ornament";
import { defaultLocale, htmlLang } from "@/i18n/locales";
import { displayName } from "@/lib/names";
import { qrDataUrl } from "@/lib/qr";
import { requireAdmin } from "@/server/policies/admin";
import { getInvitation, revealInvitationLink } from "@/server/services/invitation.service";
import { PrintButton } from "./print-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.invitations"))("print") };
}

/** Printable QR card. Rendering it decrypts the link, so it is audited like a QR download. */
export default async function PrintInvitationPage({ params }: PageProps<"/admin/invitations/[id]/print">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const inv = await getInvitation(ctx, id).catch(() => notFound());
  if (inv.status === "REVOKED") notFound();
  const { url, locale } = await revealInvitationLink(ctx, id, defaultLocale, "qr_download");
  const [qr, t, tl] = await Promise.all([
    qrDataUrl(url, 600),
    getTranslations({ locale, namespace: "Admin.invitations" }),
    getTranslations({ locale, namespace: "Landing" }),
  ]);
  const owner = inv.type === "INDIVIDUAL" ? inv.guest : inv.group;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-8 print:p-0">
      {/* The card is in the invitation's language, which may differ from the admin UI language. */}
      <article lang={htmlLang(locale)} className="w-full max-w-sm rounded-3xl border border-border p-8 text-center print:border-0">
        <p className="eyebrow">{tl("eyebrow")}</p>
        <Ornament className="my-4" />
        <h1 className="font-display text-2xl text-purple-deep">{owner ? displayName(owner, locale) : ""}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated server-side */}
        <img src={qr} alt={t("qr")} width={300} height={300} className="mx-auto my-6 size-64" />
        <p className="text-xs break-all text-muted-foreground">{url}</p>
      </article>
      <PrintButton label={t("print")} />
    </div>
  );
}
