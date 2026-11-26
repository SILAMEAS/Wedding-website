"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { moveContentAction } from "@/server/actions/content.actions";

export function MoveButtons({ model, id, first, last }: { model: "weddingLocation" | "photoAlbum" | "storyMilestone"; id: string; first: boolean; last: boolean }) {
  const t = useTranslations("Admin.content");
  const { run, pending } = useAction();
  return (
    <span className="inline-flex">
      <Button variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={pending || first} onClick={() => run(() => moveContentAction({ model, id, direction: "up" }))}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t("moveDown")} disabled={pending || last} onClick={() => run(() => moveContentAction({ model, id, direction: "down" }))}>
        <ArrowDown />
      </Button>
    </span>
  );
}
