"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { IconButton, RowActions, StatusBadge, UserCell } from "@/components/ds";
import { DISPUTE_STATUS } from "@/constants/status";
import { formatBRL, formatDate } from "@/lib/format";
import type { DisputeRow } from "../api";

export function buildDisputeColumns({ onView }: { onView: (d: DisputeRow) => void }): ColumnDef<DisputeRow, unknown>[] {
  return [
    {
      id: "code",
      header: "Disputa",
      cell: ({ row: { original: d } }) => (
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-navy">{d.code}</div>
          <div className="max-w-[200px] truncate text-xs text-muted-foreground">
            {d.task.title} · {d.task.code}
          </div>
        </div>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row: { original: d } }) => <UserCell name={d.client.name} avatarUrl={d.client.avatarUrl} size="sm" />,
    },
    {
      id: "tasker",
      header: "Profissional",
      cell: ({ row: { original: d } }) =>
        d.tasker ? (
          <UserCell name={d.tasker.name} avatarUrl={d.tasker.avatarUrl} size="sm" />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "reason",
      header: "Motivo",
      meta: { className: "max-w-[260px]" },
      cell: ({ row: { original: d } }) => (
        <p className="truncate text-sm text-muted-foreground" title={d.reason}>
          {d.reason}
        </p>
      ),
    },
    {
      id: "amount",
      header: "Valor",
      meta: { align: "right" },
      cell: ({ row: { original: d } }) => <span className="font-semibold tabular-nums text-navy">{formatBRL(d.amount)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row: { original: d } }) => <StatusBadge map={DISPUTE_STATUS} status={d.status} />,
    },
    {
      id: "createdAt",
      header: "Data",
      enableSorting: true,
      cell: ({ row: { original: d } }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(d.createdAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row: { original: d } }) => (
        <RowActions>
          <IconButton icon={Eye} label="Ver disputa" onClick={() => onView(d)} />
        </RowActions>
      ),
    },
  ];
}
