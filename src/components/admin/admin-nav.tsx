"use client";

import {
  BarChart3,
  CalendarDays,
  Coins,
  Download,
  Heart,
  History,
  Images,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageSquareHeart,
  ScanLine,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Only routes that exist are listed — no placeholder links.
const SECTIONS = [
  {
    key: null,
    items: [
      { href: "/admin/dashboard", key: "dashboard", icon: LayoutDashboard },
      { href: "/admin/check-in", key: "checkIn", icon: ScanLine },
    ],
  },
  {
    key: "sectionGuests",
    items: [
      { href: "/admin/invitations", key: "invitations", icon: Mail },
      { href: "/admin/guests", key: "guests", icon: Users },
      { href: "/admin/groups", key: "groups", icon: UsersRound },
    ],
  },
  {
    key: "sectionWebsite",
    items: [
      { href: "/admin/content", key: "content", icon: Heart },
      { href: "/admin/events", key: "events", icon: CalendarDays },
      { href: "/admin/locations", key: "locations", icon: MapPin },
      { href: "/admin/gallery", key: "gallery", icon: Images },
    ],
  },
  {
    key: "sectionGifts",
    items: [
      { href: "/admin/gifts", key: "gifts", icon: Coins },
      { href: "/admin/wishes", key: "wishes", icon: MessageSquareHeart },
      { href: "/admin/payment-methods", key: "paymentMethods", icon: Wallet },
    ],
  },
  {
    key: "sectionRecords",
    items: [
      { href: "/admin/analytics", key: "analytics", icon: BarChart3 },
      { href: "/admin/exports", key: "exports", icon: Download },
      { href: "/admin/audit-logs", key: "auditLogs", icon: History },
      { href: "/admin/security", key: "security", icon: ShieldCheck },
    ],
  },
] as const;

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("menu")} className="flex flex-col gap-4">
      {SECTIONS.map((section) => {
        const headingId = section.key ? `nav-${section.key}` : undefined;
        return (
          <div key={section.key ?? "main"} role={section.key ? "group" : undefined} aria-labelledby={headingId}>
            {section.key && (
              <p id={headingId} className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                {t(section.key)}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map(({ href, key, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-lavender",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {t(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
