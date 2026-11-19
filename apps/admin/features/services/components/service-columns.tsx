"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { IconButton, RowActions, StatusBadge } from "@/components/ds";
import { GENERIC_STATUS } from "@/constants/status";
import { formatBRL, formatNumber } from "@/lib/format";
import type { ServiceRow } from "../api";
import { ServiceIcon } from "./service-icon";

export type ServiceActions = {
  onEdit: (row: ServiceRow) => void;
  onToggle: (row: ServiceRow) => void;
  onRemove: (row: ServiceRow) => void;
  togglingId?: string | null;
  /** Set for read-only admins: every action renders disabled with this tooltip. */
  readOnlyReason?: string;
};

export function serviceColumns(actions: ServiceActions): ColumnDef<ServiceRow, any>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: "Serviço",
      enableSorting: true,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex min-w-[240px] items-center gap-3">
            <ServiceIcon icon={s.icon} name={s.name} muted={!s.isActive} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-navy">{s.name}</div>
              <div className="max-w-[320px] truncate text-xs text-muted-foreground">
                {s.description || <span className="font-mono">/{s.slug}</span>}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "professionalsCount",
      accessorKey: "professionalsCount",
      header: "Profissionais",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue<number>())}</span>,
    },
    {
      id: "tasksCount",
      accessorKey: "tasksCount",
      header: "Solicitações",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="tabular-nums">
          <div className="font-semibold text-navy">{formatNumber(row.original.tasksCount)}</div>
          <div className="text-2xs text-muted-foreground">{formatNumber(row.original.completedTasksCount)} concluídas</div>
        </div>
      ),
    },
    {
      id: "avgTicket",
      accessorKey: "avgTicket",
      header: "Ticket médio",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ getValue }) => <span className="tabular-nums">{formatBRL(getValue<number>())}</span>,
    },
    {
      id: "gmv",
      accessorKey: "gmv",
      header: "GMV",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ getValue }) => <span className="font-semibold tabular-nums text-navy">{formatBRL(getValue<number>())}</span>,
    },
    {
      id: "isActive",
      accessorKey: "isActive",
      header: "Status",
      enableSorting: true,
      cell: ({ row }) => (
        <StatusBadge map={GENERIC_STATUS} status={row.original.isActive ? "active" : "inactive"} />
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row }) => {
        const s = row.original;
        const hasTasks = s.tasksCount > 0;
        return (
          <RowActions>
            <IconButton
              icon={Pencil}
              label={`Editar ${s.name}`}
              disabledReason={actions.readOnlyReason}
              onClick={() => actions.onEdit(s)}
            />
            <IconButton
              icon={s.isActive ? PowerOff : Power}
              label={s.isActive ? "Desativar" : "Ativar"}
              disabled={actions.togglingId === s.id}
              disabledReason={actions.readOnlyReason}
              onClick={() => actions.onToggle(s)}
            />
            <IconButton
              icon={Trash2}
              tone="danger"
              label="Excluir"
              disabledReason={
                actions.readOnlyReason ?? (hasTasks ? "Possui solicitações — desative em vez de excluir" : undefined)
              }
              onClick={() => actions.onRemove(s)}
            />
          </RowActions>
        );
      },
    },
  ];
}
