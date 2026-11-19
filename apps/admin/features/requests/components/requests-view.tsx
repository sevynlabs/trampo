"use client";

import { useMemo } from "react";
import { CalendarClock, Download, Loader2 } from "lucide-react";
import { DataTable, FilterBar, FilterSelect, PageHeader, PeriodSelect, SearchInput, SectionCard } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { isPeriod } from "@/constants/period";
import { usePreferredPeriod, useUrlState } from "@/hooks/use-url-state";
import {
  REQUEST_SORT_KEYS,
  useExportRequestsCsv,
  useRequestCategories,
  useRequestStatusCounts,
  useRequests,
  type RequestSortBy,
} from "../api";
import { requestColumns } from "./request-columns";
import { RequestDetailSheet } from "./request-detail-sheet";
import { StatusChips, chipStatuses, parseRequestStatusChip } from "./status-chips";

const PAGE_SIZE = 20;

export function RequestsView() {
  const [url, setUrl] = useUrlState({
    q: "",
    page: "1",
    status: "all",
    category: "all",
    period: "",
    sortBy: "createdAt",
    sortDir: "desc",
    id: "",
  });

  const preferredPeriod = usePreferredPeriod();
  const period = isPeriod(url.period) ? url.period : preferredPeriod;
  const status = parseRequestStatusChip(url.status);
  const sortBy: RequestSortBy = (REQUEST_SORT_KEYS as readonly string[]).includes(url.sortBy)
    ? (url.sortBy as RequestSortBy)
    : "createdAt";
  const sortDir = url.sortDir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(url.page) || 1);

  const list = useRequests({
    page,
    pageSize: PAGE_SIZE,
    search: url.q.trim() || undefined,
    statuses: chipStatuses(status),
    categoryId: url.category !== "all" ? url.category : undefined,
    period,
    sortBy,
    sortDir,
  });
  const counts = useRequestStatusCounts(period);
  const categories = useRequestCategories();
  const exporter = useExportRequestsCsv();

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Todas" },
      ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (inativo)` })),
    ],
    [categories.data]
  );

  const open = (id: string) => setUrl({ id }, { resetPage: false });
  const columns = useMemo(
    () => requestColumns({ onOpen: (r) => setUrl({ id: r.id }, { resetPage: false }) }),
    [setUrl]
  );

  const filtered = !!url.q || status !== "all" || url.category !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitações"
        description="Acompanhe todos os pedidos de serviço feitos na plataforma"
        actions={
          <Button onClick={() => exporter.run(period)} disabled={exporter.pending}>
            {exporter.pending ? <Loader2 className="animate-spin" /> : <Download />}
            Exportar CSV
          </Button>
        }
      />

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <SearchInput
              value={url.q}
              onChange={(v) => setUrl({ q: v })}
              placeholder="Buscar por código, usuário ou serviço"
            />
            <FilterSelect
              label="Categoria"
              value={url.category}
              onChange={(v) => setUrl({ category: v })}
              options={categoryOptions}
              className="min-w-[180px]"
            />
            <PeriodSelect value={period} onChange={(p) => setUrl({ period: p })} />
          </FilterBar>

          <StatusChips value={status} onChange={(v) => setUrl({ status: v })} counts={counts.data} />

          <DataTable
            columns={columns}
            data={list.data?.items}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(r) => r.id}
            rowLabel={(r) => `Solicitação ${r.code}: ${r.title}`}
            onRowClick={(r) => open(r.id)}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: list.data?.total ?? 0,
              onPageChange: (p) => setUrl({ page: String(p) }, { resetPage: false }),
            }}
            sorting={{
              sortBy,
              sortDir,
              onChange: (by, dir) => setUrl({ sortBy: by, sortDir: dir }),
            }}
            empty={{
              icon: CalendarClock,
              title: filtered ? "Nenhuma solicitação encontrada" : "Nenhuma solicitação no período",
              description: filtered ? "Ajuste a busca, a categoria ou o status." : "Tente ampliar o período.",
            }}
          />
        </div>
      </SectionCard>

      <RequestDetailSheet id={url.id || null} onOpenChange={(o) => !o && setUrl({ id: "" }, { resetPage: false })} />
    </div>
  );
}
