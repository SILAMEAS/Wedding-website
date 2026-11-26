"use client";

import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth.actions";
import { AdminLanguageSwitcher } from "./admin-language-switcher";
import { AdminNav } from "./admin-nav";

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-3 pt-2">
        <p className="font-serif text-xl text-purple-deep">{t("brand")}</p>
        <p className="font-display text-sm text-gold-ink">សិលា & គឹមសួ</p>
      </div>
      <AdminNav onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-3 px-1">
        <AdminLanguageSwitcher />
        <a href="/" target="_blank" rel="noopener" className="flex items-center gap-2 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ExternalLink className="size-4" aria-hidden />
          {t("nav.viewSite")}
        </a>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="size-4" aria-hidden />
            {t("nav.signOut")}
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr] print:block">
      <aside className="hidden border-r border-border bg-sidebar lg:block print:hidden">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <p className="font-serif text-lg text-purple-deep">{t("brand")}</p>
        <Button variant="ghost" size="icon" aria-label={t("nav.menu")} aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu />
        </Button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
          <button type="button" aria-label={t("common.cancel")} className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-xl">
            <Button variant="ghost" size="icon" className="absolute top-3 right-3" aria-label={t("common.cancel")} onClick={() => setOpen(false)}>
              <X />
            </Button>
            {sidebar}
          </div>
        </div>
      )}

      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 lg:py-10 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
