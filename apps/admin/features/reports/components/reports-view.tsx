"use client";

import { useMemo, useState } from "react";
import { CalendarClock, HardHat, UserPlus, Wallet } from "lucide-react";
import { AreaChart, CHART_COLORS, ChartCard, ErrorState, HBarChart, KpiCard, PageHeader, PeriodSelect } from "@/components/ds";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePeriod } from "@/hooks/use-url-state";
import { periodLabel } from "@/constants/period";
import { formatBRL, formatNumber } from "@/lib/format";
import { bucketLabel, useByCategory, useReportSummary, useRevenueSeries, useUsersSeries } from "../api";
import { ExportMenu } from "./export-menu";

/** Reais → "R$ 1.234,56" (charts get values in reais so the axis reads naturally). */
const brlFromReais = (v: number) => formatBRL(Math.round(v * 100));

function ChartSlot({
  loading,
  error,
  onRetry,
  height = 240,
  children,
}: {
  loading: boolean;
  error?: string;
  onRetry: () => void;
  height?: number;
  children: React.ReactNode;
}) {
  if (loading) return <Skeleton className="w-full rounded-xl" style={{ height }} />;
  if (error) return <ErrorState description={error} onRetry={onRetry} className="py-8" />;
  return <>{children}</>;
}

export function ReportsView() {
  const [period, setPeriod] = usePeriod();
  const [categoryMetric, setCategoryMetric] = useState<"tasks" | "gmv">("tasks");

  const summary = useReportSummary(period);
  const revenue = useRevenueSeries(period);
  const categories = useByCategory(period);
  const users = useUsersSeries(period);

  const cur = summary.data?.current;
  const growth = summary.data?.growth;
  const hasPrevious = !!summary.data?.previous;
  const compareHint = hasPrevious ? "vs. período anterior" : period === "all" ? "sem comparação" : undefined;

  const revenueData = useMemo(
    () =>
      revenue.data?.points.map((p) => ({
        label: bucketLabel(p.bucket, revenue.data.granularity),
        value: p.gmv / 100,
        secondary: p.revenue / 100,
      })) ?? [],
    [revenue.data]
  );
  const usersData = useMemo(
    () =>
      users.data?.points.map((p) => ({
        label: bucketLabel(p.bucket, users.data.granularity),
        value: p.newUsers,
        secondary: p.newProfessionals,
      })) ?? [],
    [users.data]
  );
  const categoryData = useMemo(
    () =>
      [...(categories.data ?? [])]
        .sort((a, b) => b[categoryMetric] - a[categoryMetric])
        .map((c) => ({ label: c.name, value: categoryMetric === "gmv" ? c.gmv / 100 : c.tasks })),
    [categories.data, categoryMetric]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description={`Desempenho da plataforma · ${periodLabel(period)}`}
        actions={
          <>
            <PeriodSelect value={period} onChange={setPeriod} className="w-[190px] sm:hidden" />
            <ExportMenu period={period} />
          </>
        }
      />

      {summary.error && (
        <ErrorState description={summary.error.message} onRetry={() => summary.refetch()} className="rounded-2xl border bg-card py-8" />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={UserPlus}
          tone="brand"
          label="Usuários novos"
          value={cur ? formatNumber(cur.newUsers) : undefined}
          delta={growth?.newUsers}
          hint={compareHint}
        />
        <KpiCard
          icon={HardHat}
          tone="sky"
          label="Profissionais novos"
          value={cur ? formatNumber(cur.newProfessionals) : undefined}
          delta={growth?.newProfessionals}
          hint={compareHint}
        />
        <KpiCard
          icon={CalendarClock}
          tone="navy"
          label="Solicitações criadas"
          value={cur ? formatNumber(cur.tasksCreated) : undefined}
          delta={growth?.tasksCreated}
          hint={cur ? `${formatNumber(cur.tasksCompleted)} concluídas` : undefined}
        />
        <KpiCard
          icon={Wallet}
          tone="success"
          label="Volume transacionado"
          value={cur ? formatBRL(cur.gmv) : undefined}
          delta={growth?.gmv}
          hint={compareHint}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Faturamento (R$)"
          value={cur ? formatBRL(cur.gmv) : undefined}
          delta={growth?.gmv}
          description={
            cur ? (
              <>
                Pagamentos confirmados · receita da plataforma <b className="text-navy">{formatBRL(cur.platformRevenue)}</b>
              </>
            ) : undefined
          }
        >
          <ChartSlot loading={revenue.isLoading} error={revenue.error?.message} onRetry={() => revenue.refetch()}>
            <AreaChart
              data={revenueData}
              height={240}
              formatValue={brlFromReais}
              seriesLabels={["Volume transacionado", "Receita da plataforma"]}
            />
            <Legend items={[{ label: "Volume transacionado", color: CHART_COLORS.brand }, { label: "Receita da plataforma", color: CHART_COLORS.sky, dashed: true }]} />
          </ChartSlot>
        </ChartCard>

        <ChartCard
          title="Solicitações por categoria"
          description={categoryMetric === "tasks" ? "Solicitações criadas no período" : "Volume pago no período (R$)"}
          action={
            <Tabs value={categoryMetric} onValueChange={(v) => setCategoryMetric(v as "tasks" | "gmv")}>
              <TabsList className="h-8">
                <TabsTrigger value="tasks" className="px-2.5 py-1 text-xs">
                  Quantidade
                </TabsTrigger>
                <TabsTrigger value="gmv" className="px-2.5 py-1 text-xs">
                  Valor
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <ChartSlot loading={categories.isLoading} error={categories.error?.message} onRetry={() => categories.refetch()}>
            <HBarChart
              data={categoryData}
              max={8}
              color={categoryMetric === "tasks" ? CHART_COLORS.sky : CHART_COLORS.brand}
              formatValue={categoryMetric === "gmv" ? brlFromReais : (v) => formatNumber(v)}
            />
          </ChartSlot>
        </ChartCard>
      </div>

      <ChartCard
        title="Crescimento de usuários"
        value={cur ? formatNumber(cur.newUsers) : undefined}
        delta={growth?.newUsers}
        description={cur ? `${formatNumber(cur.newProfessionals)} novos perfis profissionais no período` : undefined}
      >
        <ChartSlot loading={users.isLoading} error={users.error?.message} onRetry={() => users.refetch()}>
          <AreaChart data={usersData} height={220} seriesLabels={["Usuários novos", "Profissionais novos"]} />
          <Legend items={[{ label: "Usuários novos", color: CHART_COLORS.brand }, { label: "Profissionais novos", color: CHART_COLORS.sky, dashed: true }]} />
        </ChartSlot>
      </ChartCard>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={i.dashed ? { backgroundImage: `linear-gradient(90deg, ${i.color} 60%, transparent 0)`, backgroundSize: "6px 2px" } : { background: i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
