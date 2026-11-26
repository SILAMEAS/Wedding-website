"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Chart conventions (dataviz method): single series per chart → brand purple
 * (validated: contrast ≥ 3:1 on white), no legend (the title names the series),
 * 2px lines with a ~10% area wash, ≤24px bars with 4px rounded data ends,
 * hairline solid grid, text in text colors (never the series color),
 * tooltip on hover, and a table view for every chart.
 */
const SERIES = "var(--wedding-purple)";
const GRID = "var(--wedding-border)";
const AXIS_TEXT = { fill: "var(--wedding-muted-strong)", fontSize: 12 };

function ChartCard({ title, subtitle, empty, table, children }: { title: string; subtitle?: string; empty: boolean; table: ReactNode; children: ReactNode }) {
  const t = useTranslations("Admin.analytics");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-xl text-purple-deep">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-48 items-center justify-center rounded-lg bg-muted/50 text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <>
            <div className="h-56 w-full" role="img" aria-label={title}>
              {children}
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{t("showTable")}</summary>
              <div className="mt-2 max-h-56 overflow-auto">{table}</div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DataTable({ rows, labelHeader, valueHeader }: { rows: { label: string; value: string }[]; labelHeader: string; valueHeader: string }) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-border">
          <th className="py-1 font-medium">{labelHeader}</th>
          <th className="py-1 text-right font-medium">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-border/50">
            <td className="py-1">{r.label}</td>
            <td className="py-1 text-right tabular-nums">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { value: number }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{format(payload[0]!.value)}</p>
    </div>
  );
}

/** Horizontal bars for categories (labels read naturally, even in Khmer). */
export function CategoryBars({ title, subtitle, data, valueHeader, format = (v) => v.toLocaleString() }: {
  title: string;
  subtitle?: string;
  data: { label: string; value: number }[];
  valueHeader: string;
  format?: (v: number) => string;
}) {
  const t = useTranslations("Admin.analytics");
  const empty = data.every((d) => d.value === 0);
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={empty}
      table={<DataTable rows={data.map((d) => ({ label: d.label, value: format(d.value) }))} labelHeader={t("category")} valueHeader={valueHeader} />}
    >
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TEXT} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={AXIS_TEXT} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--wedding-lavender)" }} content={<TooltipBox format={format} />} />
          <Bar dataKey="value" fill={SERIES} maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} style={{ fill: "var(--wedding-text)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Change over time: 2px line + 10% wash, end value labelled, crosshair tooltip. */
export function TimeSeries({ title, subtitle, data, valueHeader, format = (v) => v.toLocaleString(), formatDay }: {
  title: string;
  subtitle?: string;
  data: { day: string; value: number }[];
  valueHeader: string;
  format?: (v: number) => string;
  formatDay: (day: string) => string;
}) {
  const t = useTranslations("Admin.analytics");
  const points = data.map((d) => ({ ...d, label: formatDay(d.day) }));
  const last = points[points.length - 1];
  return (
    <ChartCard
      title={title}
      subtitle={last ? `${subtitle ? `${subtitle} · ` : ""}${t("latest")}: ${format(last.value)}` : subtitle}
      empty={points.length === 0}
      table={<DataTable rows={points.map((d) => ({ label: d.label, value: format(d.value) }))} labelHeader={t("day")} valueHeader={valueHeader} />}
    >
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="label" tick={AXIS_TEXT} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => format(v)} allowDecimals={false} />
          <Tooltip cursor={{ stroke: "var(--wedding-muted)", strokeWidth: 1 }} content={<TooltipBox format={format} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            fill={SERIES}
            fillOpacity={0.1}
            dot={points.length === 1 ? { r: 4, fill: SERIES, stroke: "#fff", strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: SERIES, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
