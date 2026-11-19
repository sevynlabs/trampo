"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Eye, Zap } from "lucide-react";
import { IconButton, RowActions, StatusBadge, UserCell } from "@/components/ds";
import { TASK_STATUS } from "@/constants/status";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import type { RequestRow } from "../api";

/** Column ids that sort on the server must match the API `sortBy` enum. */
export function requestColumns({ onOpen }: { onOpen: (row: RequestRow) => void }): ColumnDef<RequestRow, any>[] {
  return [
    {
      id: "code",
      header: "# Solicitação",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs font-semibold text-navy">{row.original.code}</span>
      ),
    },
    {
      id: "service",
      header: "Serviço",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-[200px] max-w-[280px]">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-navy">{r.title}</span>
              {r.isUrgent && (
                <Zap className="h-3.5 w-3.5 shrink-0 fill-brand text-brand" aria-label="Urgente" />
              )}
              {r.hasDispute && (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-label="Possui disputa" />
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{r.category.name}</div>
          </div>
        );
      },
    },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => (
        <UserCell name={row.original.client.name} avatarUrl={row.original.client.avatarUrl} size="sm" className="min-w-[150px]" />
      ),
    },
    {
      id: "tasker",
      header: "Profissional",
      cell: ({ row }) =>
        row.original.tasker ? (
          <UserCell name={row.original.tasker.name} avatarUrl={row.original.tasker.avatarUrl} size="sm" className="min-w-[150px]" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "totalValue",
      header: "Valor",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-navy">{formatBRL(row.original.totalValue)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge map={TASK_STATUS} status={row.original.status} />,
    },
    {
      id: "scheduledAt",
      header: "Agendamento",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.scheduledAt ? formatDateTime(row.original.scheduledAt) : <span className="text-muted-foreground">Sem data</span>}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Criação",
      enableSorting: true,
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row }) => (
        <RowActions>
          <IconButton icon={Eye} label={`Ver solicitação ${row.original.code}`} onClick={() => onOpen(row.original)} />
        </RowActions>
      ),
    },
  ];
}
