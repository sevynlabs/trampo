"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { IconButton, RowActions, StatusBadge, UserCell } from "@/components/ds";
import { PAYMENT_STATUS } from "@/constants/status";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { shortId, type PaymentRow } from "../api";

/** listPayments has no server sorting, so no column is sortable. */
export function paymentColumns({ onOpen }: { onOpen: (row: PaymentRow) => void }): ColumnDef<PaymentRow, any>[] {
  return [
    {
      id: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs font-semibold text-navy" title={row.original.id}>
          {shortId(row.original.id)}
        </span>
      ),
    },
    {
      id: "service",
      header: "Serviço",
      cell: ({ row }) => (
        <div className="min-w-[180px] max-w-[280px]">
          <div className="truncate font-semibold text-navy">{row.original.taskTitle ?? "—"}</div>
          {row.original.taskId && (
            <div className="font-mono text-2xs text-muted-foreground">Solicitação {shortId(row.original.taskId)}</div>
          )}
        </div>
      ),
    },
    {
      id: "payer",
      header: "Usuário",
      cell: ({ row }) => <UserCell name={row.original.payerName} size="sm" subtitle="Cliente" className="min-w-[150px]" />,
    },
    {
      id: "amount",
      header: "Valor",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="whitespace-nowrap tabular-nums">
          <div className="font-semibold text-navy">{formatBRL(row.original.amount)}</div>
          <div className="text-2xs text-muted-foreground">Taxa {formatBRL(row.original.platformFee)}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge map={PAYMENT_STATUS} status={row.original.status} />,
    },
    {
      id: "createdAt",
      header: "Data",
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div>{formatDate(row.original.createdAt)}</div>
          {row.original.paidAt && (
            <div className="text-2xs text-muted-foreground">Pago {formatDateTime(row.original.paidAt)}</div>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row }) => (
        <RowActions>
          <IconButton icon={Eye} label={`Ver pagamento ${shortId(row.original.id)}`} onClick={() => onOpen(row.original)} />
        </RowActions>
      ),
    },
  ];
}
