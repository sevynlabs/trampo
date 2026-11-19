"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, TicketPercent, Ticket, TimerOff } from "lucide-react";
import { ConfirmDialog, DataTable, FilterBar, FilterSelect, PageHeader, SearchInput, SectionCard, StatCard } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { COUPON_STATUS } from "@/constants/status";
import { useAdminRole } from "@/hooks/use-admin-role";
import { useUrlState } from "@/hooks/use-url-state";
import { formatNumber } from "@/lib/format";
import { couponState, useCoupons, useDeleteCoupon, useToggleCoupon, type CouponRow } from "../api";
import { CampaignsNav } from "./campaigns-nav";
import { couponColumns, couponValueLabel } from "./coupons-columns";
import { CouponDialog } from "./coupons-dialog";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  ...Object.entries(COUPON_STATUS).map(([value, d]) => ({ value, label: d.label })),
];

/** Campanhas → Cupons: promotional codes (admin.marketing.*). */
export function CouponsView() {
  const [s, set] = useUrlState({ q: "", status: "all" });
  const list = useCoupons();
  const { canEdit, readOnlyReason } = useAdminRole();

  const [creating, setCreating] = useState(false);
  const [toToggle, setToToggle] = useState<CouponRow | null>(null);
  const [toRemove, setToRemove] = useState<CouponRow | null>(null);
  const toggle = useToggleCoupon(() => setToToggle(null));
  const remove = useDeleteCoupon(() => setToRemove(null));

  const columns = useMemo(
    () => couponColumns({ onToggle: setToToggle, onRemove: setToRemove, readOnlyReason }),
    [readOnlyReason]
  );

  const all = list.data;
  const rows = useMemo(() => {
    const q = s.q.trim().toUpperCase();
    return all?.filter((c) => (s.status === "all" || couponState(c) === s.status) && (!q || c.code.includes(q)));
  }, [all, s.q, s.status]);

  const kpis = useMemo(() => {
    if (!all) return null;
    const states = all.map((c) => couponState(c));
    return {
      total: all.length,
      active: states.filter((x) => x === "active").length,
      ended: states.filter((x) => x === "expired" || x === "exhausted").length,
      uses: all.reduce((n, c) => n + c.usedCount, 0),
    };
  }, [all]);

  const filtered = !!s.q || s.status !== "all";
  const newButton = canEdit && (
    <Button onClick={() => setCreating(true)}>
      <Plus /> Novo cupom
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Campanhas", href: "/campaigns" }, { label: "Cupons" }]}
        title="Cupons"
        description="Códigos promocionais de desconto para os usuários do app."
        actions={
          <>
            <CampaignsNav />
            {newButton}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Ticket} tone="brand" label="Cupons cadastrados" value={kpis ? formatNumber(kpis.total) : undefined} />
        <StatCard icon={CheckCircle2} tone="success" label="Ativos agora" value={kpis ? formatNumber(kpis.active) : undefined} />
        <StatCard icon={TimerOff} tone="navy" label="Expirados ou esgotados" value={kpis ? formatNumber(kpis.ended) : undefined} />
        <StatCard icon={TicketPercent} tone="sky" label="Usos registrados" value={kpis ? formatNumber(kpis.uses) : undefined} />
      </div>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Buscar pelo código" />
            <FilterSelect label="Status" value={s.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
          </FilterBar>
          <DataTable
            columns={columns}
            data={rows}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(c) => c.id}
            rowLabel={(c) => `Cupom ${c.code}`}
            clientPageSize={20}
            empty={
              filtered
                ? { icon: Ticket, title: "Nenhum cupom encontrado", description: "Ajuste a busca ou o filtro de status." }
                : {
                    icon: Ticket,
                    title: "Nenhum cupom ainda",
                    description: "Crie um código promocional para atrair e reter usuários.",
                    action: newButton || undefined,
                  }
            }
          />
        </div>
      </SectionCard>

      <CouponDialog open={creating} onOpenChange={setCreating} />

      <ConfirmDialog
        open={!!toToggle}
        onOpenChange={(o) => !o && setToToggle(null)}
        title={toToggle?.isActive ? `Desativar o cupom ${toToggle.code}?` : `Ativar o cupom ${toToggle?.code ?? ""}?`}
        description={
          toToggle?.isActive
            ? "O código deixa de ser aceito no app até ser reativado. Usos já registrados não são afetados."
            : `O código volta a ser aceito no app (${toToggle ? couponValueLabel(toToggle) : ""} de desconto), respeitando validade e limite de usos.`
        }
        confirmLabel={toToggle?.isActive ? "Desativar" : "Ativar"}
        tone={toToggle?.isActive ? "danger" : "default"}
        loading={toggle.isPending}
        onConfirm={() => toToggle && toggle.mutate({ id: toToggle.id, isActive: !toToggle.isActive })}
      />

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Excluir o cupom ${toRemove?.code ?? ""}?`}
        description={
          toRemove?.usedCount
            ? `Este cupom já foi usado ${formatNumber(toRemove.usedCount)} vez(es). A exclusão é permanente — prefira desativar para manter o histórico.`
            : "Esta ação é permanente e não pode ser desfeita."
        }
        confirmLabel="Excluir cupom"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => toRemove && remove.mutate({ id: toRemove.id })}
      />
    </div>
  );
}
