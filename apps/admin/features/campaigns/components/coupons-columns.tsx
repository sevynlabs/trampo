"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { IconButton, RowActions, StatusBadge } from "@/components/ds";
import { COUPON_STATUS } from "@/constants/status";
import { formatBRL, formatDate, formatNumber } from "@/lib/format";
import { COUPON_KIND_LABEL, couponState, type CouponRow } from "../api";

export type CouponActions = {
  onToggle: (row: CouponRow) => void;
  onRemove: (row: CouponRow) => void;
  /** Set for read-only admins: actions render disabled with this tooltip. */
  readOnlyReason?: string;
};

export function couponValueLabel(c: Pick<CouponRow, "kind" | "value">): string {
  return c.kind === "PERCENT" ? `${c.value}%` : formatBRL(c.value);
}

/** Client-side table (listCoupons isn't paginated): code, kind/value, usage, validity, status. */
export function couponColumns(a: CouponActions): ColumnDef<CouponRow, any>[] {
  return [
    {
      id: "code",
      accessorKey: "code",
      header: "Código",
      enableSorting: true,
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-sm font-bold text-navy">{row.original.code}</span>,
    },
    {
      id: "value",
      accessorFn: (c) => (c.kind === "PERCENT" ? c.value : c.value / 100),
      header: "Desconto",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div className="font-semibold tabular-nums text-navy">{couponValueLabel(row.original)}</div>
          <div className="text-2xs text-muted-foreground">{COUPON_KIND_LABEL[row.original.kind]}</div>
        </div>
      ),
    },
    {
      id: "usage",
      accessorKey: "usedCount",
      header: "Uso / limite",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ row }) => {
        const c = row.original;
        const pct = c.maxUses ? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100)) : null;
        return (
          <div className="ml-auto w-[120px] text-right">
            <div className="tabular-nums">
              <b className="text-navy">{formatNumber(c.usedCount)}</b>
              <span className="text-muted-foreground"> / {c.maxUses ? formatNumber(c.maxUses) : "∞"}</span>
            </div>
            {pct !== null && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "validUntil",
      accessorFn: (c) => c.validUntil ?? "9999",
      header: "Validade",
      enableSorting: true,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="whitespace-nowrap">
            <div>{c.validUntil ? `Até ${formatDate(c.validUntil)}` : "Sem prazo"}</div>
            {c.validFrom && <div className="text-2xs text-muted-foreground">A partir de {formatDate(c.validFrom)}</div>}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge map={COUPON_STATUS} status={couponState(row.original)} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row }) => {
        const c = row.original;
        return (
          <RowActions>
            <IconButton
              icon={c.isActive ? PowerOff : Power}
              label={c.isActive ? `Desativar ${c.code}` : `Ativar ${c.code}`}
              disabledReason={a.readOnlyReason}
              onClick={() => a.onToggle(c)}
            />
            <IconButton
              icon={Trash2}
              tone="danger"
              label={`Excluir ${c.code}`}
              disabledReason={a.readOnlyReason}
              onClick={() => a.onRemove(c)}
            />
          </RowActions>
        );
      },
    },
  ];
}
