"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { fieldAria, FormField } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type ChangePasswordInput, changePasswordSchema } from "@/features/auth/schemas";
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from "@/server/actions/auth.actions";

export function ChangePasswordForm() {
  const t = useTranslations("Admin.security");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const { register, handleSubmit, reset, setError, formState } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const res = await run(() => changePasswordAction(values), { success: t("changed"), onSuccess: () => reset() });
    if (!res.ok && res.fieldErrors) {
      for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as keyof ChangePasswordInput, { message: v });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("password")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField id="currentPassword" label={t("currentPassword")} error={e.currentPassword?.message}>
            <Input type="password" autoComplete="current-password" {...fieldAria("currentPassword", e.currentPassword?.message)} {...register("currentPassword")} />
          </FormField>
          <FormField id="newPassword" label={t("newPassword")} hint={t("newPasswordHint")} error={e.newPassword?.message}>
            <Input type="password" autoComplete="new-password" {...fieldAria("newPassword", e.newPassword?.message, "h")} {...register("newPassword")} />
          </FormField>
          <FormField id="confirmPassword" label={t("confirmPassword")} error={e.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...fieldAria("confirmPassword", e.confirmPassword?.message)} {...register("confirmPassword")} />
          </FormField>
          <Button type="submit" disabled={pending}>{pending ? tc("saving") : t("password")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

type SessionRow = { id: string; device: string; lastSeen: string; signedIn: string; isCurrent: boolean };

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations("Admin.security");
  const { run, pending } = useAction();
  const others = sessions.filter((s) => !s.isCurrent).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("sessions")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {s.device} {s.isCurrent && <StatusBadge tone="brand" className="ml-1">{t("current")}</StatusBadge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("lastActive")}: {s.lastSeen} · {t("signedIn")}: {s.signedIn}
                </p>
              </div>
              {!s.isCurrent && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => revokeSessionAction(s.id))}>
                  {t("signOutDevice")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {others > 0 && (
          <ConfirmAction
            trigger={<Button variant="outline">{t("signOutOthers")}</Button>}
            title={t("signOutOthers")}
            description={t("othersSignedOut", { count: others })}
            confirmLabel={t("signOutOthers")}
            action={() => revokeOtherSessionsAction()}
          />
        )}
      </CardContent>
    </Card>
  );
}
