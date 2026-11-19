"use client";

import { useMemo, useState } from "react";
import { Ban, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import {
  ConfirmDialog,
  DataTable,
  DisabledHint,
  FilterBar,
  FilterSelect,
  PageHeader,
  SearchInput,
  SectionCard,
} from "@/components/ds";
import { useUrlState } from "@/hooks/use-url-state";
import { useAdminRole } from "@/hooks/use-admin-role";
import { formatNumber } from "@/lib/format";
import { USER_SORT_KEYS, useSetUserActive, useUsersList, type UserRow, type UserSortBy } from "../api";
import { userColumns } from "./users-columns";
import { UserDrawer } from "./user-summary";
import { RoleDialog, type RoleTarget } from "./role-dialog";
import { UserActiveDialog, type ActiveTarget } from "./user-active-dialog";
import { InviteDialog } from "./invite-dialog";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "blocked", label: "Bloqueados" },
];

const ROLE_FILTER_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "CLIENT", label: "Cliente" },
  { value: "TASKER", label: "Profissional" },
  { value: "BOTH", label: "Ambos" },
];

export const USER_INVITE_TEXT =
  "Oi! Estou te convidando para o TRAMPO, o app para contratar profissionais de confiança perto de você. " +
  "Baixe o app TRAMPO na loja do seu celular (Google Play ou App Store), toque em \"Criar conta\" e entre com o número do seu celular. " +
  "Você recebe um código por SMS e já pode pedir seu primeiro serviço.";

/** Usuários: header + filters + server-paginated table + drawers/dialogs. */
export function UsersList() {
  const [s, set] = useUrlState({ q: "", page: "1", status: "all", role: "ALL", sortBy: "createdAt", sortDir: "desc" });
  const { canEdit, readOnlyReason } = useAdminRole();
  const sortBy: UserSortBy = (USER_SORT_KEYS as readonly string[]).includes(s.sortBy) ? (s.sortBy as UserSortBy) : "createdAt";
  const sortDir = s.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(s.page) || 1);
  const status = STATUS_OPTIONS.some((o) => o.value === s.status) ? (s.status as "all" | "active" | "blocked") : "all";
  const role = ROLE_FILTER_OPTIONS.some((o) => o.value === s.role) ? (s.role as "ALL" | "CLIENT" | "TASKER" | "BOTH") : "ALL";

  const query = useUsersList({ page, pageSize: PAGE_SIZE, search: s.q.trim() || undefined, status, role, sortBy, sortDir });

  const [viewId, setViewId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<RoleTarget | null>(null);
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Selection is per page/filter: the table remounts (and clears) when this key changes.
  const [bulkRound, setBulkRound] = useState(0);
  const tableKey = `${page}|${s.q}|${status}|${role}|${sortBy}|${sortDir}|${bulkRound}`;
  const [selection, setSelection] = useState<{ key: string; rows: UserRow[] }>({ key: "", rows: [] });
  const selected = selection.key === tableKey ? selection.rows : [];
  const [bulk, setBulk] = useState<null | "block" | "unblock">(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkMutation = useSetUserActive({ silent: true });

  const columns = useMemo(
    () =>
      userColumns({
        onView: (u) => setViewId(u.id),
        onEdit: (u) => setRoleTarget({ id: u.id, name: u.name, role: u.role }),
        onToggleActive: (u) => setActiveTarget({ id: u.id, name: u.name, isActive: u.isActive }),
        readOnlyReason,
      }),
    [readOnlyReason]
  );

  async function runBulk(kind: "block" | "unblock") {
    const targets = selected.filter((u) => (kind === "block" ? u.isActive : !u.isActive));
    setBulkLoading(true);
    const results = await Promise.allSettled(
      targets.map((u) => bulkMutation.mutateAsync({ id: u.id, active: kind === "unblock" }))
    );
    setBulkLoading(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (ok) toast.success(`${ok} usuário(s) ${kind === "block" ? "bloqueado(s)" : "desbloqueado(s)"}`);
    if (failed) toast.error(`${failed} não puderam ser alterados`);
    setBulk(null);
    setBulkRound((n) => n + 1);
  }

  const data = query.data;
  const hasFilters = !!s.q || status !== "all" || role !== "ALL";
  const toBlock = selected.filter((u) => u.isActive).length;
  const toUnblock = selected.filter((u) => !u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description={data ? `${formatNumber(data.total)} usuário(s) · clientes e profissionais da plataforma` : "Clientes e profissionais da plataforma"}
        actions={
          canEdit && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Novo usuário
            </Button>
          )
        }
      />

      <SectionCard contentClassName="space-y-4">
        <FilterBar>
          <SearchInput
            value={s.q}
            onChange={(v) => set({ q: v })}
            placeholder="Buscar por nome, e-mail ou telefone…"
          />
          <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
          <FilterSelect label="Tipo" value={role} onChange={(v) => set({ role: v })} options={ROLE_FILTER_OPTIONS} />
        </FilterBar>

        {selected.length > 0 && (
          <div
            role="region"
            aria-label="Ações em massa"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/50 px-4 py-2.5"
          >
            <span className="text-sm font-semibold text-navy">{selected.length} selecionado(s)</span>
            <span className="flex-1" />
            {toBlock > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setBulk("block")}>
                <Ban /> Bloquear ({toBlock})
              </Button>
            )}
            {toUnblock > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulk("unblock")}>
                <ShieldCheck /> Desbloquear ({toUnblock})
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setBulkRound((n) => n + 1)}>
              <X /> Limpar
            </Button>
          </div>
        )}

        <DataTable
          key={tableKey}
          columns={columns}
          data={data?.users}
          loading={query.isLoading}
          error={query.error?.message}
          onRetry={() => query.refetch()}
          getRowId={(r) => r.id}
          rowLabel={(r) => r.name ?? r.phone}
          onRowClick={(r) => setViewId(r.id)}
          selectable={canEdit}
          onSelectionChange={(rows) => setSelection({ key: tableKey, rows })}
          empty={{
            icon: Users,
            title: hasFilters ? "Nenhum usuário encontrado" : "Ainda não há usuários",
            description: hasFilters
              ? "Ajuste a busca ou os filtros de status e tipo."
              : "Os usuários aparecem aqui assim que criarem a conta pelo app.",
          }}
          pagination={
            data
              ? {
                  page: data.page,
                  pageSize: data.pageSize,
                  total: data.total,
                  onPageChange: (p) => set({ page: String(p) }, { resetPage: false }),
                }
              : undefined
          }
          sorting={{ sortBy, sortDir, onChange: (by, dir) => set({ sortBy: by, sortDir: dir }) }}
        />
      </SectionCard>

      <UserDrawer
        userId={viewId}
        onOpenChange={(o) => !o && setViewId(null)}
        actions={(d) => (
          <>
            <DisabledHint hint={readOnlyReason}>
              <Button
                variant="outline"
                disabled={!canEdit}
                onClick={() => setRoleTarget({ id: d.user.id, name: d.user.name, role: d.user.role })}
              >
                Editar
              </Button>
            </DisabledHint>
            <DisabledHint hint={readOnlyReason}>
              <Button
                variant={d.user.isActive ? "destructive" : "outline"}
                disabled={!canEdit}
                onClick={() => setActiveTarget({ id: d.user.id, name: d.user.name, isActive: d.user.isActive })}
              >
                {d.user.isActive ? "Bloquear" : "Desbloquear"}
              </Button>
            </DisabledHint>
          </>
        )}
      />
      <RoleDialog target={roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)} />
      <UserActiveDialog target={activeTarget} onOpenChange={(o) => !o && setActiveTarget(null)} />
      <ConfirmDialog
        open={bulk !== null}
        onOpenChange={(o) => !o && setBulk(null)}
        title={bulk === "block" ? `Bloquear ${toBlock} usuário(s)?` : `Desbloquear ${toUnblock} usuário(s)?`}
        description={
          bulk === "block"
            ? "Os usuários selecionados perdem o acesso ao app até serem desbloqueados."
            : "O acesso ao app dos usuários selecionados é restabelecido."
        }
        tone={bulk === "block" ? "danger" : "default"}
        confirmLabel={bulk === "block" ? "Bloquear" : "Desbloquear"}
        loading={bulkLoading}
        onConfirm={() => bulk && runBulk(bulk)}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        icon={UserPlus}
        title="Novo usuário"
        description="As contas são criadas pelo próprio usuário no app TRAMPO, com o número de celular confirmado por código (SMS). O painel não cria contas, para garantir que cada telefone pertence a quem se cadastra."
        steps={[
          "A pessoa baixa o app TRAMPO na loja do celular.",
          "Toca em \"Criar conta\" e informa o número de celular.",
          "Confirma o código recebido por SMS e completa o nome.",
          "A conta aparece nesta lista automaticamente.",
        ]}
        inviteText={USER_INVITE_TEXT}
      />
    </div>
  );
}
