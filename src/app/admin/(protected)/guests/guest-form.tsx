"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { fieldAria, FormField, NativeSelect } from "@/components/admin/form-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type GuestInput, guestInputSchema } from "@/features/guests/schemas";
import { GUEST_CATEGORIES, GUEST_SIDES } from "@/features/shared/schemas";
import { createGuestAction, updateGuestAction } from "@/server/actions/guest.actions";

type GroupOption = { id: string; label: string };

export function GuestForm({ guestId, defaults, groups }: { guestId?: string; defaults?: GuestInput; groups: GroupOption[] }) {
  const t = useTranslations("Admin.guests");
  const tc = useTranslations("Admin.common");
  const tcat = useTranslations("Admin.categories");
  const tside = useTranslations("Admin.sides");
  const router = useRouter();
  const { run, pending } = useAction();
  const { register, handleSubmit, setError, formState } = useForm<GuestInput>({
    resolver: zodResolver(guestInputSchema),
    defaultValues: defaults ?? { nameKh: "", nameEn: "", category: "OTHER" },
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const res = await run(() => (guestId ? updateGuestAction(guestId, values) : createGuestAction(values)), {
      success: guestId ? tc("saved") : t("created"),
    });
    if (res.ok) {
      router.push("/admin/guests");
    } else if (res.fieldErrors) {
      for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as keyof GuestInput, { message: v });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
      <FormField id="nameKh" label={t("nameKh")} error={e.nameKh?.message}>
        <Input lang="km" {...fieldAria("nameKh", e.nameKh?.message)} {...register("nameKh")} />
      </FormField>
      <FormField id="nameEn" label={t("nameEn")} error={e.nameEn?.message}>
        <Input lang="en" {...fieldAria("nameEn", e.nameEn?.message)} {...register("nameEn")} />
      </FormField>
      <FormField id="category" label={t("category")} error={e.category?.message}>
        <NativeSelect {...fieldAria("category", e.category?.message)} {...register("category")}>
          {GUEST_CATEGORIES.map((c) => <option key={c} value={c}>{tcat(c)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="side" label={t("side")} optional error={e.side?.message}>
        <NativeSelect {...fieldAria("side", e.side?.message)} {...register("side")}>
          <option value="">—</option>
          {GUEST_SIDES.map((s) => <option key={s} value={s}>{tside(s)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="relationship" label={t("relationship")} optional hint={t("relationshipHint")} error={e.relationship?.message}>
        <Input {...fieldAria("relationship", e.relationship?.message, "h")} {...register("relationship")} />
      </FormField>
      <FormField id="groupId" label={t("group")} optional error={e.groupId?.message}>
        <NativeSelect {...fieldAria("groupId", e.groupId?.message)} {...register("groupId")}>
          <option value="">{t("noGroup")}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="phone" label={t("phone")} optional error={e.phone?.message}>
        <Input type="tel" inputMode="tel" autoComplete="off" {...fieldAria("phone", e.phone?.message)} {...register("phone")} />
      </FormField>
      <FormField id="email" label={t("email")} optional error={e.email?.message}>
        <Input type="email" autoComplete="off" {...fieldAria("email", e.email?.message)} {...register("email")} />
      </FormField>
      <FormField id="notes" label={tc("notes")} optional hint={tc("notesHint")} error={e.notes?.message} className="sm:col-span-2">
        <Textarea rows={3} {...fieldAria("notes", e.notes?.message, "h")} {...register("notes")} />
      </FormField>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
      </div>
    </form>
  );
}
