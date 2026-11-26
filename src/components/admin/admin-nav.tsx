"use client";

import { BarChart3, CalendarDays, Coins, Download, Heart, History, ScanLine, Images, LayoutDashboard, Mail, MapPin, MessageSquareHeart, ShieldCheck, Users, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Only routes that exist are listed — no placeholder links.
const ITEMS = [
  { href: "/admin/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/admin/check-in", key: "checkIn", icon: ScanLine },
  { href: "/admin/invitations", key: "invitations", icon: Mail },
  { href: "/admin/guests", key: "guests", icon: Users },
  { href: "/admin/groups", key: "groups", icon: UsersRound },
  { href: "/admin/content", key: "content", icon: Heart },
  { href: "/admin/events", key: "events", icon: CalendarDays },
  { href: "/admin/locations", key: "locations", icon: MapPin },
  { href: "/admin/gallery", key: "gallery", icon: Images },
  { href: "/admin/gifts", key: "gifts", icon: Coins },
  { href: "/admin/wishes", key: "wishes", icon: MessageSquareHeart },
  { href: "/admin/payment-methods", key: "paymentMethods", icon: Wallet },
  { href: "/admin/analytics", key: "analytics", icon: BarChart3 },
  { href: "/admin/exports", key: "exports", icon: Download },
  { href: "/admin/audit-logs", key: "auditLogs", icon: History },
  { href: "/admin/security", key: "security", icon: ShieldCheck },
] as const;

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("menu")} className="flex flex-col gap-1">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-lavender",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
