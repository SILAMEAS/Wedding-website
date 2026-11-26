"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { overrideRsvpAction } from "@/server/actions/interaction.actions";

type Status = "ATTENDING" | "DECLINED" | "MAYBE";

/** Couple sets/corrects a reply (e.g. a guest phoned). Works after the deadline; reason required and audited. */
export function RsvpOverride({
  invitationId,
  members,
  allowUnnamed,
  capacity,
  current,
}: {
  invitationId: string;
  members: { id: string; label: string }[];
  allowUnnamed: boolean;
  capacity: number;
  current: { status: Status; attendees: string[]; unnamedGuests: number; dietary: string; note: string } | null;
}) {
  const t = useTranslations("Admin.invitations");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(current?.status ?? "ATTENDING");
  const [attendees, setAttendees] = useState<string[]>(current?.attendees ?? members.map((m) => m.id));
  const [unnamed, setUnnamed] = useState(String(current?.unnamedGuests ?? 0));
  const [dietary, setDietary] = useState(current?.dietary ?? "");
  const [reason, setReason] = useState("");
  const attending = status !== "DECLINED";
  const total = (attending ? attendees.length + (Number(unnamed) || 0) : 0);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        {current ? t("overrideEdit") : t("overrideAdd")}
      </Button>
    );
  }

  return (
    <Card className="border-soft-purple">
      <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{t("overrideTitle")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <FormField id="ov-status" label={tc("status")}>
          <NativeSelect id="ov-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="ATTENDING">{t("rsvpStatus.ATTENDING")}</option>
            <option value="DECLINED">{t("rsvpStatus.DECLINED")}</option>
            <option value="MAYBE">{t("rsvpStatus.MAYBE")}</option>
          </NativeSelect>
        </FormField>
        {attending && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("members")}</legend>
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={attendees.includes(m.id)} onCheckedChange={(c) => setAttendees((a) => (c === true ? [...a, m.id] : a.filter((x) => x !== m.id)))} />
                {m.label}
              </label>
            ))}
            {allowUnnamed && (
              <FormField id="ov-unnamed" label={t("unnamedLabel")}>
                <Input id="ov-unnamed" type="number" min={0} max={capacity} value={unnamed} onChange={(e) => setUnnamed(e.target.value)} className="max-w-24" />
              </FormField>
            )}
            <p className={total > capacity ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{t("seatsUsed", { count: total, capacity })}</p>
          </fieldset>
        )}
        <FormField id="ov-diet" label={t("dietary")} optional>
          <Input id="ov-diet" value={dietary} onChange={(e) => setDietary(e.target.value)} />
        </FormField>
        <FormField id="ov-reason" label={t("overrideReason")} hint={t("overrideReasonHint")}>
          <Textarea id="ov-reason" rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <div className="flex gap-2">
          <Button
            disabled={pending || reason.trim().length < 3 || total > capacity}
            onClick={() =>
              run(
                () =>
                  overrideRsvpAction({
                    invitationId,
                    reason,
                    rsvp: { status, attendees: attending ? attendees : [], unnamedGuests: attending ? Number(unnamed) || 0 : 0, dietary, note: current?.note ?? "" },
                  }),
                { success: tc("saved"), onSuccess: () => { setOpen(false); setReason(""); } },
              )
            }
          >
            {tc("save")}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
