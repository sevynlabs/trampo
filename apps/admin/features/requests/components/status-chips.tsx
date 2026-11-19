"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { RequestStatusCounts, TaskStatus } from "../api";

/**
 * Status filter as grouped chips with counts summed from `statusCounts`.
 * Each chip maps to one or more TaskStatus, sent to the API as `statuses`.
 * The chip key is what goes to the URL (`?status=em_andamento`).
 */
export const REQUEST_STATUS_CHIPS = [
  { value: "all", label: "Todas", statuses: [] },
  { value: "aguardando", label: "Aguardando", statuses: ["OPEN"] },
  { value: "em_andamento", label: "Em andamento", statuses: ["ACCEPTED", "IN_PROGRESS"] },
  { value: "concluidas", label: "Concluídas", statuses: ["COMPLETED", "RELEASED"] },
  { value: "canceladas", label: "Canceladas", statuses: ["CANCELLED"] },
  { value: "em_disputa", label: "Em disputa", statuses: ["DISPUTED"] },
] as const satisfies readonly { value: string; label: string; statuses: readonly TaskStatus[] }[];

type Chip = (typeof REQUEST_STATUS_CHIPS)[number];
export type RequestStatusChip = Chip["value"];

export function isRequestStatusChip(v: string): v is RequestStatusChip {
  return REQUEST_STATUS_CHIPS.some((c) => c.value === v);
}

/** Chip key from the URL; old links with a raw TaskStatus (`?status=OPEN`) land on its group. */
export function parseRequestStatusChip(v: string): RequestStatusChip {
  if (isRequestStatusChip(v)) return v;
  const legacy = REQUEST_STATUS_CHIPS.find((c) => (c.statuses as readonly string[]).includes(v));
  return legacy?.value ?? "all";
}

/** TaskStatus list for the API (`undefined` = no status filter). */
export function chipStatuses(chip: RequestStatusChip): TaskStatus[] | undefined {
  const c: Chip | undefined = REQUEST_STATUS_CHIPS.find((x) => x.value === chip);
  return c && c.statuses.length ? [...c.statuses] : undefined;
}

function chipCount(chip: Chip, counts: RequestStatusCounts): number {
  if (chip.value === "all") return counts.total;
  return (chip.statuses as readonly TaskStatus[]).reduce((sum, s) => sum + (counts.counts[s] ?? 0), 0);
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
        const n = counts ? chipCount(c, counts) : undefined;
        const alert = c.value === "em_disputa" && (n ?? 0) > 0;
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
