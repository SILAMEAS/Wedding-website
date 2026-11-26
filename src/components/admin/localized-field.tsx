"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Loc = { kh: string; en: string };

/**
 * Khmer + English inputs for one piece of content. Shows a hint when only
 * one language is filled (the site falls back to the other language).
 */
export function LocalizedField({
  id,
  label,
  value,
  onChange,
  error,
  multiline = false,
  rows = 4,
  required = false,
  hint,
  maxLength,
}: {
  id: string;
  label: string;
  value: Loc;
  onChange: (v: Loc) => void;
  error?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: string;
  maxLength?: number;
}) {
  const tv = useTranslations("Validation");
  const tc = useTranslations("Admin.common");
  const tl = useTranslations("Admin.content");
  const oneMissing = (value.kh.trim() === "") !== (value.en.trim() === "");
  const field = (lang: "kh" | "en") => {
    const props = {
      id: `${id}-${lang}`,
      lang: lang === "kh" ? "km" : "en",
      value: value[lang],
      maxLength,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [lang]: e.target.value }),
    };
    return multiline ? <Textarea rows={rows} {...props} /> : <Input {...props} />;
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {label}
        {!required && <span className="ml-1 font-normal text-muted-foreground">({tc("optional")})</span>}
      </legend>
      <div className={cn("grid gap-3", multiline ? "lg:grid-cols-2" : "sm:grid-cols-2")}>
        {(["kh", "en"] as const).map((lang) => (
          <div key={lang} className="space-y-1">
            <Label htmlFor={`${id}-${lang}`} className="text-xs text-muted-foreground">
              {lang === "kh" ? "ខ្មែរ" : "English"}
            </Label>
            {field(lang)}
          </div>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {oneMissing && !error && <p className="text-xs text-amber-700">{tl("missingTranslation")}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {tv.has(error as never) ? tv(error as never) : tv("invalid")}
        </p>
      )}
    </fieldset>
  );
}

export const emptyLoc = (): Loc => ({ kh: "", en: "" });

/** First error for a field or any of its sub-paths (e.g. "groomName.kh"). */
export function errorFor(errors: Record<string, string>, field: string): string | undefined {
  return errors[field] ?? Object.entries(errors).find(([k]) => k.startsWith(`${field}.`))?.[1];
}
