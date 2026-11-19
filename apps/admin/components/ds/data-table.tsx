"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "./states";
import { Pagination } from "./pagination";
import { usePanelPrefs, type TableDensity } from "@/hooks/use-panel-prefs";

/** Per-column presentation hints (set in `columnDef.meta`). */
export type ColumnMeta = {
  className?: string;
  headerClassName?: string;
  align?: "left" | "right" | "center";
};

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;
    align?: "left" | "right" | "center";
  }
}

export type ServerPagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export type ServerSorting = {
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onChange: (sortBy: string, sortDir: "asc" | "desc") => void;
};

/**
 * The panel's table. Works in two modes:
 *  - server: pass `pagination` (+ `sorting`) — the API pages/sorts.
 *  - client: omit them — TanStack sorts and pages the given array.
 * Columns opt into sorting with `enableSorting: true` (server: column `id`
 * is sent as `sortBy`). Selection is opt-in via `selectable`.
 * Row density follows the admin's panel preference (Configurações → Painel)
 * unless `density` is passed.
 */
export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onRetry,
  getRowId,
  onRowClick,
  empty,
  pagination,
  sorting,
  clientPageSize = 10,
  selectable,
  onSelectionChange,
  stickyHeader = true,
  className,
  rowLabel,
  density: densityProp,
}: {
  columns: ColumnDef<T, any>[];
  data: T[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ComponentProps<typeof EmptyState>;
  pagination?: ServerPagination;
  sorting?: ServerSorting;
  clientPageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  stickyHeader?: boolean;
  className?: string;
  /** Accessible name for a row (screen readers), e.g. row => row.name */
  rowLabel?: (row: T) => string;
  /** Overrides the panel preference: `comfortable` (default) or `compact`. */
  density?: TableDensity;
}) {
  const prefs = usePanelPrefs();
  const compact = (densityProp ?? prefs.density) === "compact";
  const [clientSorting, setClientSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const allColumns = useMemo<ColumnDef<T, any>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id: "__select",
        enableSorting: false,
        meta: { className: "w-10", headerClassName: "w-10" },
        header: ({ table }) => (
          <Checkbox
            aria-label="Selecionar todos"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Selecionar linha"
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      ...columns,
    ];
  }, [columns, selectable]);

  const serverSortState: SortingState = sorting?.sortBy ? [{ id: sorting.sortBy, desc: sorting.sortDir === "desc" }] : [];

  const table = useReactTable({
    data: data ?? [],
    columns: allColumns,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    state: {
      sorting: sorting ? serverSortState : clientSorting,
      rowSelection,
    },
    enableSorting: true,
    enableSortingRemoval: false,
    manualSorting: !!sorting,
    manualPagination: !!pagination,
    onSortingChange: (updater) => {
      const prev = sorting ? serverSortState : clientSorting;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (sorting) {
        const s = next[0];
        if (s) sorting.onChange(s.id, s.desc ? "desc" : "asc");
      } else setClientSorting(next);
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
      if (onSelectionChange) {
        const ids = new Set(Object.keys(next).filter((k) => next[k]));
        onSelectionChange(table.getRowModel().rows.filter((r) => ids.has(r.id)).map((r) => r.original));
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sorting ? undefined : getSortedRowModel(),
    getPaginationRowModel: pagination ? undefined : getPaginationRowModel(),
    initialState: { pagination: { pageSize: clientPageSize } },
  });

  const rows = table.getRowModel().rows;
  const colCount = allColumns.length;
  const alignClass = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className={cn("space-y-4", className)} data-density={compact ? "compact" : "comfortable"}>
      <div className="overflow-hidden rounded-xl border border-border/70">
        <div className={cn("overflow-x-auto", stickyHeader && "max-h-[70vh] overflow-y-auto")}>
          <table className="w-full caption-bottom text-sm">
            <thead className={cn("bg-muted/60 text-xs", stickyHeader && "sticky top-0 z-10 backdrop-blur")}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border/70">
                  {hg.headers.map((h) => {
                    const meta = h.column.columnDef.meta;
                    const canSort = h.column.getCanSort() && h.column.columnDef.enableSorting === true;
                    const dir = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                        className={cn(
                          "whitespace-nowrap px-4 font-semibold text-muted-foreground",
                          compact ? "h-9" : "h-11",
                          alignClass(meta?.align),
                          meta?.headerClassName
                        )}
                      >
                        {h.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={h.column.getToggleSortingHandler()}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              dir && "text-navy"
                            )}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : dir === "desc" ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                            )}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="bg-card">
              {loading ? (
                Array.from({ length: Math.min(pagination?.pageSize ?? clientPageSize, 8) }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {Array.from({ length: colCount }).map((__, j) => (
                      <td key={j} className={cn("px-4", compact ? "py-2" : "py-3.5")}>
                        <Skeleton className={cn("w-full", compact ? "h-4" : "h-5")} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={colCount}>
                    <ErrorState description={error} onRetry={onRetry} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    <EmptyState {...empty} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    aria-label={rowLabel?.(row.original)}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row.original);
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      "border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40 data-[state=selected]:bg-brand-soft/60",
                      onRowClick && "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn("px-4 align-middle", compact ? "py-1.5" : "py-3", alignClass(cell.column.columnDef.meta?.align), cell.column.columnDef.meta?.className)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination ? (
        pagination.total > 0 && <Pagination {...pagination} />
      ) : (
        (data?.length ?? 0) > clientPageSize && (
          <Pagination
            page={table.getState().pagination.pageIndex + 1}
            pageSize={table.getState().pagination.pageSize}
            total={data?.length ?? 0}
            onPageChange={(p) => table.setPageIndex(p - 1)}
            onPageSizeChange={(s) => table.setPageSize(s)}
          />
        )
      )}
    </div>
  );
}

/** Row actions cell wrapper: stops row-click propagation. */
export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
