"use client";

import { type ColumnDef, flexRender, getCoreRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataColumn = { id: string; header: string; sortable?: boolean; align?: "right" };
export type DataRow = { id: string; cells: Record<string, ReactNode> };

/**
 * TanStack Table with SERVER-side sorting/pagination: the sort lives in the URL
 * (?sort=…&dir=asc|desc), so it survives reloads, works with the server
 * pagination and never sorts only the visible page.
 */
export function DataTable({ columns, rows, emptyText }: { columns: DataColumn[]; rows: DataRow[]; emptyText: string }) {
  const t = useTranslations("Admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sorting: SortingState = params.get("sort") ? [{ id: params.get("sort")!, desc: params.get("dir") !== "asc" }] : [];

  // Rendered per request with server data; skipping compiler memoization here is fine.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<DataRow>({
    data: rows,
    columns: columns.map<ColumnDef<DataRow>>((c) => ({
      id: c.id,
      header: c.header,
      // TanStack only allows sorting columns with an accessor; the value is unused (sorting is server-side).
      accessorFn: (r) => r.id,
      enableSorting: !!c.sortable,
      cell: (info) => info.row.original.cells[c.id] ?? null,
    })),
    state: { sorting },
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const sp = new URLSearchParams(params.toString());
      const s = next[0];
      if (s) {
        sp.set("sort", s.id);
        sp.set("dir", s.desc ? "desc" : "asc");
      } else {
        sp.delete("sort");
        sp.delete("dir");
      }
      sp.delete("page"); // new order → back to page 1
      router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    },
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const col = columns.find((c) => c.id === h.column.id);
                const dir = h.column.getIsSorted();
                return (
                  <TableHead
                    key={h.id}
                    className={cn(col?.align === "right" && "text-right")}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                  >
                    {h.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn("inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-2", col?.align === "right" && "flex-row-reverse")}
                        title={t("sortBy", { column: String(h.column.columnDef.header) })}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : dir === "desc" ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn(columns.find((c) => c.id === cell.column.id)?.align === "right" && "text-right tabular-nums")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
