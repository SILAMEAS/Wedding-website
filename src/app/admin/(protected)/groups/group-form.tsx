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
import { type GroupInput, groupInputSchema } from "@/features/groups/schemas";
import { GUEST_CATEGORIES, GUEST_SIDES } from "@/features/shared/schemas";
import { createGroupAction, updateGroupAction } from "@/server/actions/group.actions";

export function GroupForm({ groupId, defaults }: { groupId?: string; defaults?: GroupInput }) {
  const t = useTranslations("Admin.groups");
  const tg = useTranslations("Admin.guests");
  const tc = useTranslations("Admin.common");
  const tcat = useTranslations("Admin.categories");
  const tside = useTranslations("Admin.sides");
  const router = useRouter();
  const { run, pending } = useAction();
  const { register, handleSubmit, setError, formState } = useForm<GroupInput>({
    resolver: zodResolver(groupInputSchema),
    defaultValues: defaults ?? { nameKh: "", nameEn: "", category: "OTHER" },
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const res = await run(() => (groupId ? updateGroupAction(groupId, values) : createGroupAction(values)), {
      success: groupId ? tc("saved") : t("created"),
      onSuccess: (data) => {
        if (!groupId) router.push(`/admin/groups/${data.id}`);
      },
    });
    if (!res.ok && res.fieldErrors) {
      for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as keyof GroupInput, { message: v });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
      <FormField id="nameKh" label={t("nameKh")} hint={t("nameHint")} error={e.nameKh?.message}>
        <Input lang="km" {...fieldAria("nameKh", e.nameKh?.message, "h")} {...register("nameKh")} />
      </FormField>
      <FormField id="nameEn" label={t("nameEn")} error={e.nameEn?.message}>
        <Input lang="en" {...fieldAria("nameEn", e.nameEn?.message)} {...register("nameEn")} />
      </FormField>
      <FormField id="category" label={tg("category")}>
        <NativeSelect id="category" {...register("category")}>
          {GUEST_CATEGORIES.map((c) => <option key={c} value={c}>{tcat(c)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="side" label={tg("side")} optional>
        <NativeSelect id="side" {...register("side")}>
          <option value="">—</option>
          {GUEST_SIDES.map((s) => <option key={s} value={s}>{tside(s)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="notes" label={tc("notes")} optional hint={tc("notesHint")} error={e.notes?.message} className="sm:col-span-2">
        <Textarea rows={2} {...fieldAria("notes", e.notes?.message, "h")} {...register("notes")} />
      </FormField>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        {!groupId && <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>}
      </div>
    </form>
  );
}
