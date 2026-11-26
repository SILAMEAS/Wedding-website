"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { fieldAria, FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type LoginInput, loginSchema } from "@/features/auth/schemas";
import { loginAction } from "@/server/actions/auth.actions";

export function LoginForm() {
  const t = useTranslations("Admin.login");
  const tErr = useTranslations("Errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      // On success the action redirects; we only get here on failure.
      const res = await loginAction(values);
      if (res && !res.ok) setError(tErr(res.error, res.details ?? {}));
    });
  });

  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="username" label={t("username")} error={e.username?.message}>
        <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...fieldAria("username", e.username?.message)} {...register("username")} />
      </FormField>
      <FormField id="password" label={t("password")} error={e.password?.message}>
        <Input type="password" autoComplete="current-password" {...fieldAria("password", e.password?.message)} {...register("password")} />
      </FormField>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
