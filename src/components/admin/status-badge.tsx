import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-soft-purple bg-lavender text-purple-deep",
} as const;

export type Tone = keyof typeof TONES;

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONES[tone], className)}>
      {children}
    </Badge>
  );
}

export function invitationTone(status: "ACTIVE" | "INACTIVE" | "REVOKED"): Tone {
  return status === "ACTIVE" ? "success" : status === "INACTIVE" ? "warning" : "danger";
}

export function rsvpTone(status: "ATTENDING" | "DECLINED" | "MAYBE" | null | undefined): Tone {
  if (status === "ATTENDING") return "success";
  if (status === "DECLINED") return "danger";
  if (status === "MAYBE") return "warning";
  return "neutral";
}
