"use client";

import { useTranslations } from "next-intl";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { archiveGuestAction, restoreGuestAction } from "@/server/actions/guest.actions";

export function GuestArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations("Admin.guests");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();

  if (archived) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => run(() => restoreGuestAction(id), { success: t("restoredToast") })}>
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
      action={() => archiveGuestAction(id)}
      success={t("archivedToast")}
    />
  );
}
