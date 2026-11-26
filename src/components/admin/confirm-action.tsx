"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/action-result";
import { useAction } from "./use-action";

/** Button that asks for confirmation before running a destructive/important action. */
export function ConfirmAction<T>({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  action,
  success,
  onSuccess,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => Promise<ActionResult<T>>;
  success?: string;
  onSuccess?: (data: T) => void;
  children?: ReactNode;
}) {
  const tc = useTranslations("Admin.common");
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={async (e) => {
                e.preventDefault();
                const res = await run(action, { success, onSuccess });
                if (res.ok) setOpen(false);
              }}
            >
              {pending ? tc("saving") : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
