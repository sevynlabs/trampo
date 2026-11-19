"use client";

import { useMemo, useState } from "react";
import { ClipboardList, HardHat, Plus, TrendingUp, Wrench } from "lucide-react";
import {
  ConfirmDialog,
  DataTable,
  FilterBar,
  FilterSelect,
  KpiCard,
  PageHeader,
  SearchInput,
  SectionCard,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { useUrlState } from "@/hooks/use-url-state";
import { formatBRL, formatNumber } from "@/lib/format";
import { useRemoveService, useServices, useToggleService, type ServiceRow } from "../api";
import { serviceColumns } from "./service-columns";
import { ServiceFormSheet } from "./service-form-sheet";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ServicesView() {
  const [url, setUrl] = useUrlState({ q: "", status: "all" });

  // The endpoint isn't paginated: load every category once (KPIs need the
  // whole set) and filter/sort on the client — search also covers description.
  const query = useServices({ status: "all" });
  const all = query.data;

  const rows = useMemo(() => {
    if (!all) return undefined;
    const q = normalize(url.q.trim());
    return all.filter((s) => {
      if (url.status === "active" && !s.isActive) return false;
      if (url.status === "inactive" && s.isActive) return false;
      if (!q) return true;
      return [s.name, s.slug, s.description ?? ""].some((f) => normalize(f).includes(q));
    });
  }, [all, url.q, url.status]);

  const kpis = useMemo(() => {
    if (!all) return null;
    return {
      active: all.filter((s) => s.isActive).length,
      total: all.length,
      professionals: all.reduce((a, s) => a + s.professionalsCount, 0),
      tasks: all.reduce((a, s) => a + s.tasksCount, 0),
      completed: all.reduce((a, s) => a + s.completedTasksCount, 0),
      gmv: all.reduce((a, s) => a + s.gmv, 0),
    };
  }, [all]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [toToggle, setToToggle] = useState<ServiceRow | null>(null);
  const [toRemove, setToRemove] = useState<ServiceRow | null>(null);

  const toggle = useToggleService();
  const remove = useRemoveService({ onSuccess: () => setToRemove(null) });

  const columns = useMemo(
    () =>
      serviceColumns({
        onEdit: (s) => {
          setEditing(s);
          setFormOpen(true);
        },
        onToggle: (s) => (s.isActive ? setToToggle(s) : toggle.mutate({ id: s.id, isActive: true })),
        onRemove: setToRemove,
        togglingId: toggle.isPending ? toggle.variables?.id : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggle.isPending, toggle.variables?.id]
  );

  const filtered = !!url.q || url.status !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        description="Gerencie as categorias de serviço da plataforma"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Novo serviço
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Wrench}
          label="Categorias ativas"
          value={kpis ? formatNumber(kpis.active) : undefined}
          hint={kpis ? `de ${formatNumber(kpis.total)} cadastradas` : undefined}
          tone="brand"
        />
        <KpiCard
          icon={HardHat}
          label="Profissionais nas categorias"
          value={kpis ? formatNumber(kpis.professionals) : undefined}
          hint="Um profissional pode atuar em várias"
          tone="sky"
        />
        <KpiCard
          icon={ClipboardList}
          label="Solicitações"
          value={kpis ? formatNumber(kpis.tasks) : undefined}
          hint={kpis ? `${formatNumber(kpis.completed)} concluídas` : undefined}
          tone="navy"
        />
        <KpiCard
          icon={TrendingUp}
          label="GMV total"
          value={kpis ? formatBRL(kpis.gmv) : undefined}
          hint="Pagamentos confirmados"
          tone="success"
        />
      </div>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <SearchInput
              value={url.q}
              onChange={(v) => setUrl({ q: v })}
              placeholder="Buscar por título ou descrição"
            />
            <FilterSelect
              label="Status"
              value={url.status}
              onChange={(v) => setUrl({ status: v })}
              options={STATUS_OPTIONS}
            />
          </FilterBar>

          <DataTable
            columns={columns}
            data={rows}
            loading={query.isLoading}
            error={query.error?.message}
            onRetry={() => query.refetch()}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.name}
            onRowClick={(s) => {
              setEditing(s);
              setFormOpen(true);
            }}
            clientPageSize={20}
            empty={
              filtered
                ? { icon: Wrench, title: "Nenhum serviço encontrado", description: "Ajuste a busca ou o filtro de status." }
                : {
                    icon: Wrench,
                    title: "Nenhum serviço cadastrado",
                    description: "Crie a primeira categoria de serviço da plataforma.",
                    action: (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditing(null);
                          setFormOpen(true);
                        }}
                      >
                        <Plus /> Novo serviço
                      </Button>
                    ),
                  }
            }
          />
        </div>
      </SectionCard>

      <ServiceFormSheet open={formOpen} onOpenChange={setFormOpen} service={editing} />

      <ConfirmDialog
        open={!!toToggle}
        onOpenChange={(o) => !o && setToToggle(null)}
        title={`Desativar "${toToggle?.name ?? ""}"?`}
        description="O serviço deixa de aparecer no app para novos pedidos e para profissionais. Solicitações existentes não são afetadas. Você pode reativá-lo a qualquer momento."
        confirmLabel="Desativar"
        tone="danger"
        loading={toggle.isPending}
        onConfirm={() =>
          toToggle && toggle.mutate({ id: toToggle.id, isActive: false }, { onSuccess: () => setToToggle(null) })
        }
      />

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Excluir "${toRemove?.name ?? ""}"?`}
        description="Esta ação é permanente e não pode ser desfeita. Só é possível excluir serviços sem solicitações."
        confirmLabel="Excluir serviço"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => toRemove && remove.mutate({ id: toRemove.id })}
      />
    </div>
  );
}
