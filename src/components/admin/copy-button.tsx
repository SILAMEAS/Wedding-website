"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations("Admin.common");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(t("copied"));
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(t("unknown"));
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {label ?? t("copy")}
    </Button>
  );
}
