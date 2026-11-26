"use client";

import { Star, UserMinus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addMemberAction,
  archiveGroupAction,
  removeMemberAction,
  restoreGroupAction,
  setPrimaryContactAction,
} from "@/server/actions/group.actions";

type Option = { id: string; label: string };

export function MemberManager({
  groupId,
  archived,
  primaryContactId,
  members,
  available,
}: {
  groupId: string;
  archived: boolean;
  primaryContactId: string | null;
  members: (Option & { relationship: string | null })[];
  available: Option[];
}) {
  const t = useTranslations("Admin.groups");
  const tg = useTranslations("Admin.guests");
  const { run, pending } = useAction();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [nameKh, setNameKh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [relationship, setRelationship] = useState("");
  const [existing, setExisting] = useState("");
  const [nameError, setNameError] = useState<string>();

  async function add() {
    setNameError(undefined);
    const input = mode === "existing" ? { groupId, existingGuestId: existing || undefined, nameEn: "", nameKh: "" } : { groupId, nameKh, nameEn, relationship };
    const res = await run(() => addMemberAction(input));
    if (res.ok) {
      setNameKh("");
      setNameEn("");
      setRelationship("");
      setExisting("");
    } else if (res.fieldErrors?.nameKh) {
      setNameError(res.fieldErrors.nameKh);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("members")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border">
          {members.length === 0 && <li className="py-2 text-sm text-muted-foreground">{t("memberCount", { count: 0 })}</li>}
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/guests/${m.id}`} className="block truncate text-sm font-medium hover:underline">{m.label}</Link>
                <p className="text-xs text-muted-foreground">
                  {m.id === primaryContactId ? t("primary") : m.relationship}
                </p>
              </div>
              {!archived && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("makePrimary")}
                    title={t("makePrimary")}
                    aria-pressed={m.id === primaryContactId}
                    disabled={pending}
                    onClick={() => run(() => setPrimaryContactAction(groupId, m.id === primaryContactId ? null : m.id))}
                  >
                    <Star className={m.id === primaryContactId ? "fill-gold text-gold" : ""} />
                  </Button>
                  <ConfirmAction
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("remove")} title={t("remove")}>
                        <UserMinus />
                      </Button>
                    }
                    title={t("remove")}
                    description={t("removeConfirm")}
                    confirmLabel={t("remove")}
                    destructive
                    action={() => removeMemberAction(groupId, m.id)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>

        {!archived && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">{t("addMember")}</p>
            <div role="tablist" className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
              {(["new", "existing"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={mode === m ? "rounded-md bg-background px-3 py-1 shadow-xs" : "px-3 py-1 text-muted-foreground"}
                >
                  {m === "new" ? t("addNew") : t("addExisting")}
                </button>
              ))}
            </div>
            {mode === "new" ? (
              <div className="space-y-2">
                <FormField id="m-nameKh" label={tg("nameKh")} error={nameError}>
                  <Input id="m-nameKh" lang="km" value={nameKh} onChange={(e) => setNameKh(e.target.value)} />
                </FormField>
                <FormField id="m-nameEn" label={tg("nameEn")}>
                  <Input id="m-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                </FormField>
                <FormField id="m-rel" label={tg("relationship")} optional>
                  <Input id="m-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
                </FormField>
              </div>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAvailable")}</p>
            ) : (
              <FormField id="m-existing" label={t("chooseGuest")}>
                <NativeSelect id="m-existing" value={existing} onChange={(e) => setExisting(e.target.value)}>
                  <option value="">—</option>
                  {available.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </NativeSelect>
              </FormField>
            )}
            <Button onClick={add} disabled={pending || (mode === "existing" && !existing)} className="w-full">
              {t("addMember")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GroupArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations("Admin.groups");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  if (archived) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => run(() => restoreGroupAction(id), { success: tc("saved") })}>
        {tc("restore")}
      </Button>
    );
  }
  return (
    <ConfirmAction
      trigger={<Button variant="ghost">{tc("archive")}</Button>}
      title={tc("archive")}
      description={t("archiveConfirm")}
      confirmLabel={tc("archive")}
      destructive
      action={() => archiveGroupAction(id)}
      success={tc("saved")}
    />
  );
}
