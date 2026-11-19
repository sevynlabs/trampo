"use client";

import { useMemo } from "react";
import { AlertOctagon, CheckCircle2, Scale, Wallet } from "lucide-react";
import {
  DataTable,
  FilterBar,
  FilterSelect,
  PageHeader,
  PeriodSelect,
  SearchInput,
  SectionCard,
  StatCard,
} from "@/components/ds";
import { useUrlState } from "@/hooks/use-url-state";
import { isPeriod, type Period } from "@/constants/period";
import { DISPUTE_STATUS } from "@/constants/status";
import { formatBRL, formatNumber } from "@/lib/format";
import { useDisputeStats, useDisputes, type DisputeListInput } from "../api";
import { buildDisputeColumns } from "./dispute-columns";
import { DisputeSheet } from "./dispute-sheet";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  ...Object.entries(DISPUTE_STATUS).map(([value, d]) => ({ value, label: d.label })),
];

export function DisputesView() {
  const [s, set] = useUrlState({ q: "", page: "1", status: "all", period: "all", sortDir: "desc", id: "" });
  const period: Period = isPeriod(s.period) ? s.period : "all";
  const page = Math.max(1, Number(s.page) || 1);

  const input: DisputeListInput = {
    page,
    pageSize: 20,
    search: s.q || undefined,
    status: (s.status in DISPUTE_STATUS ? s.status : "all") as DisputeListInput["status"],
    period,
    sortDir: s.sortDir === "asc" ? "asc" : "desc",
  };

  const stats = useDisputeStats();
  const list = useDisputes(input);
  const open = (id: string) => set({ id }, { resetPage: false });
  const columns = useMemo(() => buildDisputeColumns({ onView: (d) => set({ id: d.id }, { resetPage: false }) }), [set]);

  const st = stats.data;
  const resolved = st ? st.counts.RESOLVED_RELEASED + st.counts.RESOLVED_REFUNDED : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Disputas" description="Medie conflitos entre clientes e profissionais e decida o destino do pagamento." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={AlertOctagon} tone="danger" label="Disputas abertas" value={st ? formatNumber(st.counts.OPEN) : undefined} />
        <StatCard icon={Wallet} tone="warning" label="Valor em disputa (abertas)" value={st ? formatBRL(st.openAmount) : undefined} />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label={st ? `Resolvidas · ${st.counts.RESOLVED_RELEASED} repasse · ${st.counts.RESOLVED_REFUNDED} reembolso` : "Resolvidas"}
          value={resolved !== undefined ? formatNumber(resolved) : undefined}
        />
        <StatCard icon={Scale} tone="navy" label="Total de disputas" value={st ? formatNumber(st.total) : undefined} />
      </div>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Buscar por código, ID (TR-…), cliente, profissional ou motivo" />
            <FilterSelect label="Status" value={input.status ?? "all"} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
            <PeriodSelect value={period} onChange={(p) => set({ period: p })} />
          </FilterBar>

          <DataTable
            columns={columns}
            data={list.data?.items}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(d) => d.id}
            onRowClick={(d) => open(d.id)}
            rowLabel={(d) => `Disputa ${d.code}`}
            empty={{
              icon: Scale,
              title: "Nenhuma disputa encontrada",
              description: "Sem disputas para os filtros selecionados.",
            }}
            pagination={{
              page,
              pageSize: 20,
              total: list.data?.total ?? 0,
              onPageChange: (p) => set({ page: String(p) }, { resetPage: false }),
            }}
            sorting={{
              sortBy: "createdAt",
              sortDir: input.sortDir,
              onChange: (_by, dir) => set({ sortDir: dir }),
            }}
          />
        </div>
      </SectionCard>

      <DisputeSheet id={s.id || null} onOpenChange={(o) => !o && set({ id: "" }, { resetPage: false })} />
    </div>
  );
}
