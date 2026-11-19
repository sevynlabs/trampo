"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { IconButton, RowActions, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GENERIC_STATUS } from "@/constants/status";
import { formatBRL, formatNumber } from "@/lib/format";
import type { ServiceRow } from "../api";
import { ServiceIcon } from "./service-icon";

export type ServiceActions = {
  onEdit: (row: ServiceRow) => void;
  onToggle: (row: ServiceRow) => void;
  onRemove: (row: ServiceRow) => void;
  togglingId?: string | null;
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
            <IconButton icon={Pencil} label={`Editar ${s.name}`} onClick={() => actions.onEdit(s)} />
            <IconButton
              icon={s.isActive ? PowerOff : Power}
              label={s.isActive ? "Desativar" : "Ativar"}
              disabled={actions.togglingId === s.id}
              onClick={() => actions.onToggle(s)}
            />
            {/* Disabled buttons don't fire pointer events: the tooltip trigger is a focusable span. */}
            {hasTasks ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-label="Excluir indisponível: o serviço possui solicitações"
                    className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Button variant="ghost" size="icon-sm" disabled aria-hidden tabIndex={-1} className="text-rose-600">
                      <Trash2 />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Possui solicitações — desative em vez de excluir</TooltipContent>
              </Tooltip>
            ) : (
              <IconButton icon={Trash2} tone="danger" label="Excluir" onClick={() => actions.onRemove(s)} />
            )}
          </RowActions>
        );
      },
    },
  ];
}
