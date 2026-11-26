import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { invitationTone, rsvpTone, StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/locales";
import { formatDate, formatDateTime, toPhnomPenhLocalInput } from "@/lib/dates";
import { bilingualName } from "@/lib/names";
import { AppError } from "@/server/errors";
import { requireAdmin } from "@/server/policies/admin";
import { getInvitation } from "@/server/services/invitation.service";
import { getRsvpHistory } from "@/server/services/rsvp.service";
import { InvitationActions, InvitationSettingsForm, LinkPanel } from "./invitation-controls";
import { RsvpOverride } from "./rsvp-override";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.invitations"))("title") };
}

export default async function InvitationDetailPage({ params, searchParams }: PageProps<"/admin/invitations/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  if (!z.uuid().safeParse(id).success) notFound();
  const inv = await getInvitation(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "notFound") notFound();
    throw e;
  });
  const [t, tc, locale, history] = await Promise.all([getTranslations("Admin.invitations"), getTranslations("Admin.common"), getLocale() as Promise<AppLocale>, getRsvpHistory(ctx, id)]);
  const owner = inv.type === "INDIVIDUAL" ? inv.guest : inv.group;
  const ownerHref = inv.type === "INDIVIDUAL" ? `/admin/guests/${inv.guest?.id}` : `/admin/groups/${inv.group?.id}`;
  const members = inv.type === "INDIVIDUAL" ? (inv.guest ? [inv.guest] : []) : (inv.group?.members ?? []);
  const revoked = inv.status === "REVOKED";
  const fmt = (d: Date | null) => (d ? formatDateTime(d, locale) : tc("never"));

  return (
    <>
      <PageHeader
        title={owner ? bilingualName(owner) : "—"}
        description={`${t(inv.type)} · ${t("capacity")} ${inv.capacity}${inv.internalLabel ? ` · ${inv.internalLabel}` : ""}`}
        actions={<StatusBadge tone={invitationTone(inv.status)} className="text-sm">{t(`statuses.${inv.status}`)}</StatusBadge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {!revoked && <LinkPanel invitationId={inv.id} autoReveal={isNew} />}

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl text-purple-deep">{t("members")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/guests/${m.id}`} className="hover:underline">{bilingualName(m)}</Link>
                  </li>
                ))}
                {inv.allowUnnamedGuests && inv.capacity > members.length && (
                  <li className="text-muted-foreground">{t("unnamedSeats", { count: inv.capacity - members.length })}</li>
                )}
              </ul>
              <Link href={ownerHref} className="mt-3 inline-block text-sm text-primary hover:underline">{tc("details")} →</Link>
            </CardContent>
          </Card>

          {inv.rsvp && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl text-purple-deep">{t("rsvpDetails")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <StatusBadge tone={rsvpTone(inv.rsvp.status)}>{t(`rsvpStatus.${inv.rsvp.status}`)}</StatusBadge>{" "}
                  <span className="text-muted-foreground">{t("rsvpReplied", { date: fmt(inv.rsvp.updatedAt), version: inv.rsvp.version })}</span>
                </p>
                <ul className="space-y-1">
                  {inv.rsvp.participants.map((p) => (
                    <li key={p.guest.id} className={p.attending ? "" : "text-muted-foreground line-through"}>
                      {bilingualName(p.guest)}
                    </li>
                  ))}
                  {inv.rsvp.unnamedGuests > 0 && <li>{t("unnamedSeats", { count: inv.rsvp.unnamedGuests })}</li>}
                </ul>
                {inv.rsvp.dietary && <p><span className="text-muted-foreground">{t("dietary")}:</span> {inv.rsvp.dietary}</p>}
                {inv.rsvp.accessibility && <p><span className="text-muted-foreground">{t("accessibility")}:</span> {inv.rsvp.accessibility}</p>}
                {inv.rsvp.note && <p className="whitespace-pre-line"><span className="text-muted-foreground">{t("guestNote")}:</span> {inv.rsvp.note}</p>}
              </CardContent>
            </Card>
          )}

          {inv.status === "ACTIVE" && (
            <RsvpOverride
              invitationId={inv.id}
              members={members.map((m) => ({ id: m.id, label: bilingualName(m) }))}
              allowUnnamed={inv.allowUnnamedGuests}
              capacity={inv.capacity}
              current={
                inv.rsvp
                  ? {
                      status: inv.rsvp.status,
                      attendees: inv.rsvp.participants.filter((p) => p.attending).map((p) => p.guest.id),
                      unnamedGuests: inv.rsvp.unnamedGuests,
                      dietary: inv.rsvp.dietary ?? "",
                      note: inv.rsvp.note ?? "",
                    }
                  : null
              }
            />
          )}

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl text-purple-deep">{t("rsvpHistory")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 border-l border-border pl-4 text-sm">
                  {history.map((h) => {
                    const snap = h.snapshot as { status: "ATTENDING" | "DECLINED" | "MAYBE"; attendingCount: number };
                    return (
                      <li key={h.version}>
                        <strong>v{h.version}</strong> · {t(`rsvpStatus.${snap.status}`)} ({snap.attendingCount}) ·{" "}
                        <span className="text-muted-foreground">{h.actor === "ADMIN" ? t("byCouple") : t("byGuest")} · {fmt(h.createdAt)}</span>
                        {h.reason && <p className="text-muted-foreground">{t("overrideReason")}: {h.reason}</p>}
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}

          {!revoked && (
            <InvitationSettingsForm
              defaults={{
                id: inv.id,
                capacity: String(inv.capacity),
                allowUnnamedGuests: inv.allowUnnamedGuests,
                preferredLocale: (inv.preferredLocale as "kh" | "en" | null) ?? "",
                internalLabel: inv.internalLabel ?? "",
                notes: inv.notes ?? "",
                rsvpDeadlineOverride: inv.rsvpDeadlineOverride ? toPhnomPenhLocalInput(inv.rsvpDeadlineOverride) : "",
              }}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl text-purple-deep">{t("activity")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-muted-foreground">{t("rsvp")}</dt><dd>
                  <StatusBadge tone={rsvpTone(inv.rsvp?.status)}>
                    {inv.rsvp ? `${t(`rsvpStatus.${inv.rsvp.status}`)} · ${inv.rsvp.attendingCount}` : t("rsvpNone")}
                  </StatusBadge>
                </dd></div>
                <div><dt className="text-muted-foreground">{t("firstOpened")}</dt><dd>{fmt(inv.firstOpenedAt)}</dd></div>
                <div><dt className="text-muted-foreground">{t("lastOpened")}</dt><dd>{fmt(inv.lastOpenedAt)}</dd></div>
                <div><dt className="text-muted-foreground">{t("opens")}</dt><dd className="tabular-nums">{inv.stats.opens}</dd></div>
                <div><dt className="text-muted-foreground">{tc("created")}</dt><dd>{fmt(inv.createdAt)}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <InvitationActions invitationId={inv.id} status={inv.status} />

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl text-purple-deep">{t("tokenHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {inv.tokens.map((tok) => (
                  <li key={tok.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{formatDate(tok.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</span>
                    <StatusBadge tone={tok.status === "ACTIVE" ? "success" : "neutral"}>{t(`tokenStatuses.${tok.status}`)}</StatusBadge>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
