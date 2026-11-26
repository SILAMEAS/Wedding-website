import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/wedding/language-switcher";
import { Link } from "@/i18n/navigation";

type NavItem = { href: string; label: string };

/** Slim sticky header. On the invitation page links are in-page anchors; elsewhere they are routes. */
export async function PublicHeader({ items, homeHref = "/" }: { items: NavItem[]; homeHref?: string }) {
  const t = await getTranslations("Invitation");
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={homeHref} className="font-serif text-xl text-purple-deep">
          S <span className="text-gold-ink">&amp;</span> K<span className="sr-only"> — {t("home")}</span>
        </Link>
        <nav aria-label={t("sectionsNav")} className="no-scrollbar -mx-1 flex flex-1 gap-1 overflow-x-auto px-1 text-sm">
          {items.map((i) =>
            i.href.startsWith("#") ? (
              <a key={i.href} href={i.href} className="shrink-0 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-lavender hover:text-purple-deep">
                {i.label}
              </a>
            ) : (
              <Link key={i.href} href={i.href} className="shrink-0 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-lavender hover:text-purple-deep">
                {i.label}
              </Link>
            ),
          )}
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
