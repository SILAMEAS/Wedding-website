import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/locales";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bilingualName } from "@/lib/names";
import { pickLocalized } from "@/lib/validation/localized";
import { AppError } from "@/server/errors";
import { requireAdmin } from "@/server/policies/admin";
import { getGift } from "@/server/services/gift-admin.service";
import { statusTone } from "../status";
import { GiftActions } from "./gift-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.gifts"))("title") };
}

type Snap = { status?: string; receivedAmount?: string | null; notifiedAmount?: string | null; currency?: string; method?: string; donorName?: string };

export default async function GiftDetailPage({ params }: PageProps<"/admin/gifts/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const g = await getGift(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "notFound") notFound();
    throw e;
  });
  const [t, locale] = await Promise.all([getTranslations("Admin.gifts"), getLocale() as Promise<AppLocale>]);
  const owner = g.invitation?.guest ?? g.invitation?.group;
  const money = (v: { toFixed(n: number): string } | string | null | undefined) => (v == null ? "—" : formatMoney(typeof v === "string" ? v : v.toFixed(2), g.currency, locale));

  return (
    <>
      <PageHeader
        title={g.donorName}
        description={`${t(`method.${g.method}`)} · ${g.source === "GUEST_NOTIFICATION" ? t("fromGuest") : t("recorded")}`}
        actions={<StatusBadge tone={statusTone[g.status]} className="text-sm">{t(`status.${g.status}`)}</StatusBadge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("details")}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{t("notified")}</dt><dd className="font-serif text-2xl tabular-nums">{money(g.notifiedAmount)}</dd></div>
                <div><dt className="text-muted-foreground">{t("received")}</dt><dd className="font-serif text-2xl text-purple-deep tabular-nums">{money(g.receivedAmount)}</dd></div>
                <div><dt className="text-muted-foreground">{t("currency")}</dt><dd>{g.currency}</dd></div>
                <div><dt className="text-muted-foreground">{t("methodLabel")}</dt><dd>{t(`method.${g.method}`)}{g.paymentMethod && ` · ${pickLocalized(g.paymentMethod.label, locale).text}`}</dd></div>
                <div><dt className="text-muted-foreground">{t("reference")}</dt><dd className="font-mono">{g.transactionRef ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">{t("transferDate")}</dt><dd>{g.transferredAt ? formatDate(g.transferredAt, locale, { dateStyle: "medium" }) : "—"}</dd></div>
                <div><dt className="text-muted-foreground">{t("receivedDate")}</dt><dd>{g.receivedAt ? formatDate(g.receivedAt, locale, { dateStyle: "medium" }) : "—"}</dd></div>
                <div>
                  <dt className="text-muted-foreground">{t("invitation")}</dt>
                  <dd>{owner && g.invitation ? <Link href={`/admin/invitations/${g.invitation.id}`} className="text-primary hover:underline">{bilingualName(owner)}</Link> : "—"}</dd>
                </div>
                {g.message && <div className="sm:col-span-2"><dt className="text-muted-foreground">{t("guestMessage")}</dt><dd className="whitespace-pre-line">{g.message}</dd></div>}
                {g.adminNote && <div className="sm:col-span-2"><dt className="text-muted-foreground">{t("adminNote")}</dt><dd className="whitespace-pre-line">{g.adminNote}</dd></div>}
              </dl>
            </CardContent>
          </Card>

          {g.evidenceAssetId && (
            <Card>
              <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("evidence")}</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">{t("evidenceNote")}</p>
                <a href={`/api/admin/gifts/${g.id}/evidence`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, admin-only image served by an authenticated route */}
                  <img src={`/api/admin/gifts/${g.id}/evidence`} alt={t("evidence")} className="max-h-96 rounded-lg border border-border" />
                </a>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("history")}</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l border-border pl-4 text-sm">
                {g.events.map((e) => {
                  const before = e.before as Snap | null;
                  const after = e.after as Snap | null;
                  return (
                    <li key={e.id}>
                      <p>
                        <strong>{t(`event.${e.type}`)}</strong>{" "}
                        <span className="text-muted-foreground">· {e.actor === "GUEST" ? t("byGuest") : t("byCouple")} · {formatDateTime(e.createdAt, locale)}</span>
                      </p>
                      {before?.receivedAmount !== after?.receivedAmount && after?.receivedAmount && (
                        <p className="text-muted-foreground">{t("amountChange", { from: before?.receivedAmount ?? "—", to: after.receivedAmount })} {after.currency}</p>
                      )}
                      {e.reason && <p className="text-muted-foreground">{t("reason")}: {e.reason}</p>}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <GiftActions
          gift={{
            id: g.id,
            version: g.version,
            status: g.status,
            currency: g.currency,
            method: g.method,
            donorName: g.donorName,
            transactionRef: g.transactionRef ?? "",
            notifiedAmount: g.notifiedAmount?.toFixed(g.currency === "KHR" ? 0 : 2) ?? "",
            receivedAmount: g.receivedAmount?.toFixed(g.currency === "KHR" ? 0 : 2) ?? "",
          }}
        />
      </div>
    </>
  );
}
