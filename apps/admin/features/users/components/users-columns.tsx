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
  /** Set for read-only admins: mutating actions render disabled with this tooltip. */
  readOnlyReason?: string;
};

/** Sortable columns (server): `name` and `createdAt` — the column id is sent as `sortBy`. */

export function userColumns(h: UserRowHandlers): ColumnDef<UserRow, unknown>[] {
  return [
    {
      id: "name",
      header: "Usuário",
      enableSorting: true,
      cell: ({ row }) => (
        <UserCell
          name={row.original.name}
          avatarUrl={row.original.avatarUrl}
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
      enableSorting: true,
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
            <IconButton
              icon={Pencil}
              label="Editar tipo de conta"
              disabledReason={h.readOnlyReason}
              onClick={() => h.onEdit(u)}
            />
            {u.isActive ? (
              <IconButton
                icon={Ban}
                label="Bloquear"
                tone="danger"
                disabledReason={h.readOnlyReason}
                onClick={() => h.onToggleActive(u)}
              />
            ) : (
              <IconButton
                icon={ShieldCheck}
                label="Desbloquear"
                disabledReason={h.readOnlyReason}
                onClick={() => h.onToggleActive(u)}
              />
            )}
          </RowActions>
        );
      },
    },
  ];
}
