"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, Pencil, ShieldCheck } from "lucide-react";
import { IconButton, RowActions, UserCell } from "@/components/ds";
import { formatDate } from "@/lib/format";
import type { UserRow } from "../api";
import { ActiveBadge, KycBadge, RoleTag } from "./user-badges";

export type UserRowHandlers = {
  onView: (row: UserRow) => void;
  onEdit: (row: UserRow) => void;
  onToggleActive: (row: UserRow) => void;
};

export function userColumns(h: UserRowHandlers): ColumnDef<UserRow, unknown>[] {
  return [
    {
      id: "user",
      header: "Usuário",
      cell: ({ row }) => (
        <UserCell
          name={row.original.name}
          subtitle={row.original.email ? `${row.original.email} · ${row.original.phone}` : row.original.phone}
        />
      ),
      meta: { className: "min-w-[260px]" },
    },
    {
      id: "role",
      header: "Tipo",
      cell: ({ row }) => <RoleTag role={row.original.role} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ActiveBadge active={row.original.isActive} />
          <KycBadge status={row.original.kycStatus} />
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Cadastro",
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <RowActions>
            <IconButton icon={Eye} label="Visualizar" onClick={() => h.onView(u)} />
            <IconButton icon={Pencil} label="Editar tipo de conta" onClick={() => h.onEdit(u)} />
            {u.isActive ? (
              <IconButton icon={Ban} label="Bloquear" tone="danger" onClick={() => h.onToggleActive(u)} />
            ) : (
              <IconButton icon={ShieldCheck} label="Desbloquear" onClick={() => h.onToggleActive(u)} />
            )}
          </RowActions>
        );
      },
    },
  ];
}
