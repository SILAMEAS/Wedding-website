"use client";

import { AlertTriangle, Camera, CameraOff, CheckCircle2, Search, Undo2, UserCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, useTransition } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmCheckInAction,
  lookupInvitationAction,
  lookupScanAction,
  searchPartiesAction,
  voidCheckInAction,
} from "@/server/actions/checkin.actions";
import type { CheckInParty } from "@/server/services/checkin.service";

const QrCamera = dynamic(() => import("./qr-camera"), { ssr: false });

type Recent = { id: string; name: string; arrivedCount: number; time: string; isOverride: boolean };

export function CheckInConsole({ recent }: { recent: Recent[] }) {
  const t = useTranslations("Admin.checkin");
  const tErr = useTranslations("Errors");
  const { run, pending } = useAction();
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [party, setParty] = useState<CheckInParty | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ invitationId: string; name: string; capacity: number; arrived: number }[]>([]);
  const [searching, startSearch] = useTransition();
  const lastScan = useRef<{ text: string; at: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const show = useCallback((p: CheckInParty) => {
    setParty(p);
    setLookupError(null);
    setDone(null);
    setOverride(false);
    setReason("");
    setNote("");
    setCount(Math.max(1, Math.min(p.capacity, p.rsvp && p.rsvp.status !== "DECLINED" ? p.rsvp.attendingCount || 1 : p.capacity)));
  }, []);

  const onScan = useCallback(
    async (text: string) => {
      // Ignore the same code read repeatedly within a few seconds.
      const now = Date.now();
      if (lastScan.current && lastScan.current.text === text && now - lastScan.current.at < 4000) return;
      lastScan.current = { text, at: now };
      const res = await lookupScanAction(text);
      if (res.ok) show(res.data);
      else {
        setParty(null);
        setLookupError(res.error === "notFound" ? t("notRecognised") : tErr(res.error, { ...res.details }));
      }
    },
    [show, t, tErr],
  );

  async function search(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      const res = await searchPartiesAction(query);
      setResults(res.ok ? res.data : []);
    });
  }

  const blocked = !!party && (party.checkIns.length > 0 || party.invitationStatus !== "ACTIVE");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl text-purple-deep">{t("scan")}</CardTitle>
            <Button variant={camera ? "outline" : "default"} onClick={() => { setCamera((c) => !c); setCameraError(null); }}>
              {camera ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {camera ? t("stopCamera") : t("startCamera")}
            </Button>
          </CardHeader>
          <CardContent>
            {camera ? (
              <div className="mx-auto max-w-sm">
                <QrCamera paused={!!party && !done} onScan={onScan} onError={(m) => { setCameraError(m); setCamera(false); }} />
                <p className="mt-2 text-center text-xs text-muted-foreground">{party && !done ? t("pausedHint") : t("pointCamera")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("cameraIntro")}</p>
            )}
            {cameraError && (
              <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {t("cameraError")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("manual")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={search} className="flex gap-2">
              <label htmlFor="ci-q" className="sr-only">{t("searchLabel")}</label>
              <Input id="ci-q" value={query} placeholder={t("searchLabel")} onChange={(e) => setQuery(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={searching || query.trim().length < 2}><Search aria-hidden /> {t("search")}</Button>
            </form>
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.invitationId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-1 py-2 text-left text-sm hover:bg-lavender"
                    onClick={async () => {
                      const res = await lookupInvitationAction(r.invitationId);
                      if (res.ok) show(res.data);
                    }}
                  >
                    <span>{r.name}</span>
                    <span className="text-xs text-muted-foreground">{t("arrivedOf", { arrived: r.arrived, capacity: r.capacity })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className={party ? "border-primary" : ""} aria-live="polite">
          <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("party")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {lookupError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{lookupError}</p>}
            {!party && !lookupError && <p className="text-sm text-muted-foreground">{t("noParty")}</p>}
            {done && (
              <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800">
                <CheckCircle2 aria-hidden /> {done}
              </p>
            )}
            {party && !done && (
              <>
                <div>
                  <p className="font-serif text-2xl text-purple-deep">{party.name}</p>
                  <p className="text-sm text-muted-foreground">{party.members.join(" · ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="brand">{t("capacity", { capacity: party.capacity })}</StatusBadge>
                  {party.rsvp ? (
                    <StatusBadge tone={party.rsvp.status === "ATTENDING" ? "success" : party.rsvp.status === "DECLINED" ? "danger" : "warning"}>
                      {t(`rsvp.${party.rsvp.status}`)} · {party.rsvp.attendingCount}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">{t("noReply")}</StatusBadge>
                  )}
                </div>
                {party.invitationStatus !== "ACTIVE" && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="size-4 shrink-0" aria-hidden /> {t(`inactive.${party.invitationStatus}`)}</p>
                )}
                {party.tokenStatus && party.tokenStatus !== "ACTIVE" && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="size-4 shrink-0" aria-hidden /> {t("oldLink")}</p>
                )}
                {party.checkIns.length > 0 && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden /> {t("alreadyArrived", { count: party.arrivedTotal })}
                  </p>
                )}
                <FormField id="ci-count" label={t("arrivingNow")}>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label={t("fewer")} disabled={count <= 1} onClick={() => setCount((c) => c - 1)}>−</Button>
                    <Input id="ci-count" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="w-20 text-center text-lg" />
                    <Button type="button" variant="outline" size="icon" aria-label={t("more")} onClick={() => setCount((c) => Math.min(50, c + 1))}>+</Button>
                  </div>
                </FormField>
                <FormField id="ci-note" label={t("note")} optional>
                  <Input id="ci-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </FormField>
                {blocked && (
                  <div className="space-y-2 rounded-lg border border-amber-200 p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="ci-override" checked={override} onCheckedChange={(c) => setOverride(c === true)} />
                      <Label htmlFor="ci-override">{t("override")}</Label>
                    </div>
                    {override && (
                      <FormField id="ci-reason" label={t("reason")}>
                        <Input id="ci-reason" value={reason} placeholder={t("reasonHint")} onChange={(e) => setReason(e.target.value)} />
                      </FormField>
                    )}
                  </div>
                )}
                <Button
                  className="h-12 w-full text-base"
                  disabled={pending || (blocked && (!override || reason.trim().length < 3))}
                  onClick={() =>
                    run(() => confirmCheckInAction({ invitationId: party.invitationId, arrivedCount: count, override: blocked && override, reason, note }), {
                      onSuccess: () => {
                        setDone(t("welcomed", { name: party.name, count }));
                        lastScan.current = null;
                        setTimeout(() => { setParty(null); setDone(null); }, 4000);
                      },
                    })
                  }
                >
                  <UserCheck aria-hidden /> {t("confirm", { count })}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setParty(null)}>{t("clear")}</Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("recent")}</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noneYet")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1">
                      {r.name} <span className="text-muted-foreground">· {r.arrivedCount} · {r.time}</span>
                      {r.isOverride && <StatusBadge tone="warning" className="ml-1">{t("overrideBadge")}</StatusBadge>}
                    </span>
                    <UndoCheckIn id={r.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UndoCheckIn({ id }: { id: string }) {
  const t = useTranslations("Admin.checkin");
  const [why, setWhy] = useState("");
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={t("undo")} title={t("undo")}>
          <Undo2 />
        </Button>
      }
      title={t("undo")}
      description={t("undoExplain")}
      confirmLabel={t("undo")}
      destructive
      action={() => voidCheckInAction({ id, reason: why })}
      success={t("undone")}
    >
      <FormField id={`undo-${id}`} label={t("reason")}>
        <Input id={`undo-${id}`} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t("undoReason")} />
      </FormField>
    </ConfirmAction>
  );
}
