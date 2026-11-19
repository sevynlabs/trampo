"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus, Plus, ShieldCheck, UserCog } from "lucide-react";
import { ConfirmDialog, DataTable, LoadingState, ErrorState, SectionCard, StatusBadge, Tag, UserCell } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADMIN_ROLE_LABEL } from "@/constants/status";
import { formatDate, formatDateTime } from "@/lib/format";
import { ADMIN_ROLES, useAdmins, useRoles, useUpdateAdmin, type AdminRole, type AdminRow, type RoleInfo } from "../api";
import { NewAdminDialog } from "./new-admin-dialog";

type Pending = { admin: AdminRow; role?: AdminRole; isActive?: boolean } | null;

function roleLabel(role: string, roles?: RoleInfo[]) {
  return roles?.find((r) => r.role === role)?.label ?? ADMIN_ROLE_LABEL[role] ?? role;
}

/** Roles × permissions matrix built from admin.settings.roles. */
function PermissionsMatrix({ roles }: { roles: RoleInfo[] }) {
  const permissions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of roles) for (const p of r.permissions) if (!seen.has(p)) (seen.add(p), out.push(p));
    return out;
  }, [roles]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {roles.map((r) => (
          <div key={r.role} className="rounded-xl border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
              <span className="text-sm font-bold text-navy">{r.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <caption className="sr-only">Permissões por papel</caption>
          <thead className="bg-muted/60 text-xs">
            <tr className="border-b border-border/70">
              <th scope="col" className="h-11 px-4 text-left font-semibold text-muted-foreground">
                Permissão
              </th>
              {roles.map((r) => (
                <th key={r.role} scope="col" className="h-11 whitespace-nowrap px-4 text-center font-semibold text-muted-foreground">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card">
            {permissions.map((p) => (
              <tr key={p} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-navy">
                  {p}
                </th>
                {roles.map((r) => {
                  const has = r.permissions.includes(p);
                  return (
                    <td key={r.role} className="px-4 py-2.5 text-center">
                      {has ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Permitido" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Não permitido" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminsTab({ meId, readOnly }: { meId?: string; readOnly: boolean }) {
  const admins = useAdmins();
  const roles = useRoles();
  const update = useUpdateAdmin();
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const columns = useMemo<ColumnDef<AdminRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Administrador",
        enableSorting: true,
        cell: ({ row: { original: a } }) => (
          <div className="flex items-center gap-2">
            <UserCell name={a.name} subtitle={a.email} size="sm" />
            {a.id === meId && <Tag tone="brand">Você</Tag>}
          </div>
        ),
      },
      {
        id: "role",
        header: "Papel",
        cell: ({ row: { original: a } }) => {
          const locked = readOnly || a.id === meId;
          return (
            <Select value={a.role} disabled={locked} onValueChange={(v) => v !== a.role && setPending({ admin: a, role: v as AdminRole })}>
              <SelectTrigger className="h-9 w-[190px]" aria-label={`Papel de ${a.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r, roles.data)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "status",
        header: "Acesso",
        cell: ({ row: { original: a } }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={a.isActive}
              disabled={readOnly || a.id === meId}
              onCheckedChange={(v) => setPending({ admin: a, isActive: v })}
              aria-label={a.isActive ? `Desativar ${a.name}` : `Reativar ${a.name}`}
            />
            {a.isActive ? <StatusBadge tone="success" label="Ativo" /> : <StatusBadge tone="neutral" label="Inativo" />}
          </div>
        ),
      },
      {
        id: "lastLoginAt",
        accessorKey: "lastLoginAt",
        header: "Último acesso",
        enableSorting: true,
        cell: ({ row: { original: a } }) => (
          <span className="whitespace-nowrap text-muted-foreground">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Nunca"}</span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Criado em",
        enableSorting: true,
        cell: ({ row: { original: a } }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(a.createdAt)}</span>,
      },
    ],
    [meId, readOnly, roles.data]
  );

  const p = pending;
  const confirmTitle = !p
    ? ""
    : p.role
      ? `Alterar papel de ${p.admin.name}?`
      : p.isActive
        ? `Reativar ${p.admin.name}?`
        : `Desativar ${p.admin.name}?`;
  const confirmDescription = !p
    ? null
    : p.role
      ? `${roleLabel(p.admin.role, roles.data)} → ${roleLabel(p.role, roles.data)}. As permissões mudam no próximo acesso ao painel.`
      : p.isActive
        ? "A pessoa volta a conseguir entrar no painel."
        : "A pessoa perde o acesso ao painel imediatamente. Você pode reativá-la depois.";

  return (
    <div className="space-y-6">
      <SectionCard
        title="Administradores"
        description="Quem acessa o painel e com qual papel."
        action={
          !readOnly && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Novo administrador
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          data={admins.data}
          loading={admins.isLoading}
          error={admins.error?.message}
          onRetry={() => admins.refetch()}
          getRowId={(a) => a.id}
          empty={{ icon: UserCog, title: "Nenhum administrador" }}
          clientPageSize={20}
        />
      </SectionCard>

      <SectionCard title="Papéis e permissões" description="O que cada papel pode fazer no painel.">
        {roles.isLoading ? (
          <LoadingState rows={5} />
        ) : roles.error ? (
          <ErrorState description={roles.error.message} onRetry={() => roles.refetch()} />
        ) : roles.data ? (
          <PermissionsMatrix roles={roles.data} />
        ) : null}
      </SectionCard>

      <NewAdminDialog open={creating} onOpenChange={setCreating} roles={roles.data} />

      <ConfirmDialog
        open={!!p}
        onOpenChange={(o) => !o && setPending(null)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={p?.role ? "Alterar papel" : p?.isActive ? "Reativar" : "Desativar"}
        tone={p && !p.role && !p.isActive ? "danger" : "default"}
        loading={update.isPending}
        onConfirm={() =>
          p &&
          update.mutate(
            { id: p.admin.id, ...(p.role ? { role: p.role } : { isActive: p.isActive }) },
            { onSettled: () => setPending(null) }
          )
        }
      />
    </div>
  );
}
