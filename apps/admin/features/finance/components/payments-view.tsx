"use client";

import { useMemo } from "react";
import { Banknote, CreditCard, Download, HandCoins, Loader2, TrendingUp, Wallet } from "lucide-react";
import { DataTable, FilterBar, FilterSelect, PageHeader, PeriodSelect, SectionCard, StatCard } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { DEFAULT_PERIOD, isPeriod, periodLabel } from "@/constants/period";
import { PAYMENT_STATUS } from "@/constants/status";
import { useUrlState } from "@/hooks/use-url-state";
import { formatBRL, formatNumber } from "@/lib/format";
import {
  periodToDays,
  useExportPaymentsCsv,
  usePayments,
  usePendingWithdrawals,
  useRevenueReport,
  type PaymentStatusFilter,
} from "../api";
import { FinanceNav } from "./finance-nav";
import { PaymentDetailSheet } from "./payment-detail-sheet";
import { paymentColumns } from "./payment-columns";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  ...Object.entries(PAYMENT_STATUS).map(([value, d]) => ({ value, label: d.label })),
];
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((o) => o.value));

export function PaymentsView() {
  const [url, setUrl] = useUrlState({ page: "1", status: "ALL", period: DEFAULT_PERIOD as string, id: "" });
  const period = isPeriod(url.period) ? url.period : DEFAULT_PERIOD;
  const status = (STATUS_VALUES.has(url.status) ? url.status : "ALL") as PaymentStatusFilter;
  const page = Math.max(1, Number(url.page) || 1);

  const list = usePayments({ page, pageSize: PAGE_SIZE, status, days: periodToDays(period) });
  const report = useRevenueReport(period);
  const pending = usePendingWithdrawals();
  const exporter = useExportPaymentsCsv();

  const r = report.data;
  const pw = pending.data;
  const kpiHint = period === "all" ? "Últimos 12 meses" : periodLabel(period);

  const columns = useMemo(
    () => paymentColumns({ onOpen: (p) => setUrl({ id: p.id }, { resetPage: false }) }),
    [setUrl]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="Cobranças, custódia, repasses e saques da plataforma"
        actions={
          <>
            <FinanceNav pendingWithdrawals={pw?.total} />
            <Button onClick={() => exporter.run(period)} disabled={exporter.pending}>
              {exporter.pending ? <Loader2 className="animate-spin" /> : <Download />}
              Exportar CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} tone="brand" label={`Total transacionado · ${kpiHint}`} value={r ? formatBRL(r.gmv) : undefined} />
        <StatCard
          icon={HandCoins}
          tone="sky"
          label={`Repasses a profissionais · ${kpiHint}`}
          value={r ? formatBRL(r.taskerPayouts) : undefined}
        />
        <StatCard
          icon={Wallet}
          tone="success"
          label={r ? `Taxas da plataforma · ${formatNumber(r.paidCount)} pagamentos` : "Taxas da plataforma"}
          value={r ? formatBRL(r.platformRevenue) : undefined}
        />
        <StatCard
          icon={Banknote}
          tone="warning"
          href="/finance/withdrawals"
          label={pw ? `Saques pendentes · ${formatNumber(pw.total)} solicitações` : "Saques pendentes"}
          value={pw ? formatBRL(pw.pendingTotal) : undefined}
        />
      </div>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <PeriodSelect value={period} onChange={(p) => setUrl({ period: p })} />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => setUrl({ status: v })}
              options={STATUS_OPTIONS}
              className="min-w-[180px]"
            />
          </FilterBar>

          <DataTable
            columns={columns}
            data={list.data?.payments}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(p) => p.id}
            rowLabel={(p) => `Pagamento ${p.taskTitle ?? p.id}`}
            onRowClick={(p) => setUrl({ id: p.id }, { resetPage: false })}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: list.data?.total ?? 0,
              onPageChange: (p) => setUrl({ page: String(p) }, { resetPage: false }),
            }}
            empty={{
              icon: CreditCard,
              title: "Nenhum pagamento encontrado",
              description: status !== "ALL" ? "Tente outro status ou amplie o período." : "Tente ampliar o período.",
            }}
          />
        </div>
      </SectionCard>

      <PaymentDetailSheet id={url.id || null} onOpenChange={(o) => !o && setUrl({ id: "" }, { resetPage: false })} />
    </div>
  );
}
