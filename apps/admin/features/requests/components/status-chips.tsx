"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { RequestStatusCounts } from "../api";

/**
 * Status filter as chips with counts (from `statusCounts`). The API filters by
 * a single TaskStatus, so each chip is exactly one status (+ "Todas").
 */
export const REQUEST_STATUS_CHIPS = [
  { value: "all", label: "Todas" },
  { value: "OPEN", label: "Aguardando" },
  { value: "ACCEPTED", label: "Aceitas" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluídas" },
  { value: "RELEASED", label: "Finalizadas" },
  { value: "CANCELLED", label: "Canceladas" },
  { value: "DISPUTED", label: "Em disputa" },
] as const;

export type RequestStatusChip = (typeof REQUEST_STATUS_CHIPS)[number]["value"];

export function isRequestStatusChip(v: string): v is RequestStatusChip {
  return REQUEST_STATUS_CHIPS.some((c) => c.value === v);
}

export function StatusChips({
  value,
  onChange,
  counts,
}: {
  value: RequestStatusChip;
  onChange: (v: RequestStatusChip) => void;
  counts: RequestStatusCounts | undefined;
}) {
  return (
    <div role="radiogroup" aria-label="Filtrar por status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {REQUEST_STATUS_CHIPS.map((c) => {
        const active = value === c.value;
        const n = counts ? (c.value === "all" ? counts.total : counts.counts[c.value]) : undefined;
        const alert = c.value === "DISPUTED" && (n ?? 0) > 0;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-navy bg-navy text-white"
                : "border-border/70 bg-card text-muted-foreground hover:border-navy/25 hover:text-navy"
            )}
          >
            {c.label}
            {n === undefined ? (
              <Skeleton className="h-4 w-5 rounded-full" />
            ) : (
              <span
                className={cn(
                  "min-w-[1.5rem] rounded-full px-1.5 text-center text-xs tabular-nums",
                  active ? "bg-white/15 text-white" : alert ? "bg-rose-50 text-rose-700" : "bg-muted text-muted-foreground"
                )}
              >
                {n.toLocaleString("pt-BR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
