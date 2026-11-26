"use client";

import { Archive, Check, EyeOff, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { editWishAction, moderateWishAction } from "@/server/actions/interaction.actions";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "ARCHIVED";

export function WishActions({ id, status, authorName, message }: { id: string; status: Status; authorName: string; message: string }) {
  const t = useTranslations("Admin.wishes");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(authorName);
  const [text, setText] = useState(message);
  const act = (a: "approve" | "reject" | "hide" | "archive", success: string) => run(() => moderateWishAction(id, a), { success });

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {["PENDING", "REJECTED", "HIDDEN"].includes(status) && (
        <Button size="sm" disabled={pending} onClick={() => act("approve", t("approved"))}>
          <Check aria-hidden /> {t("approve")}
        </Button>
      )}
      {["PENDING", "APPROVED", "HIDDEN"].includes(status) && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act("reject", t("rejected"))}>
          <X aria-hidden /> {t("reject")}
        </Button>
      )}
      {status === "APPROVED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act("hide", t("hidden"))}>
          <EyeOff aria-hidden /> {t("hide")}
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> {tc("edit")}
          </Button>
          <ConfirmAction
            trigger={<Button size="sm" variant="ghost"><Archive aria-hidden /> {t("archive")}</Button>}
            title={t("archive")}
            description={t("archiveConfirm")}
            confirmLabel={t("archive")}
            action={() => moderateWishAction(id, "archive")}
          />
        </>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`n-${id}`}>{t("name")}</Label>
              <Input id={`n-${id}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`m-${id}`}>{t("message")}</Label>
              <Textarea id={`m-${id}`} rows={5} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">{t("editNote")}</p>
            <Button disabled={pending} onClick={() => run(() => editWishAction({ id, authorName: name, message: text }), { success: tc("saved"), onSuccess: () => setEditing(false) })}>
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
