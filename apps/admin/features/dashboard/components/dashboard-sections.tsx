"use client";

import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  HardHat,
  Scale,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart,
  CHART_COLORS,
  ChartCard,
  Delta,
  DonutChart,
  HBarChart,
  KpiCard,
  SectionCard,
  type CardTone,
} from "@/components/ds";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBRL, formatNumber, formatPercent } from "@/lib/format";
import { periodLabel, type Period } from "@/constants/period";
import {
  useDashboardOverview,
  useReportsSeries,
  useReportsSummary,
  useTaskFunnel,
  useTaskStatusCounts,
} from "../api";
import { bucketLabel, ChartBody } from "./helpers";

/** Row of 4 headline KPIs (totals + growth in the selected period). */
export function DashboardKpis({ period }: { period: Period }) {
  const overview = useDashboardOverview();
  const summary = useReportsSummary(period);
  const o = overview.data;
  const s = summary.data;
  const failed = overview.isError || summary.isError;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          tone="brand"
          label="Usuários"
          value={o ? formatNumber(o.totalUsers) : failed ? "—" : undefined}
          delta={s ? s.growth.newUsers : undefined}
          hint={s ? `${formatNumber(s.current.newUsers)} novos no período` : undefined}
          href="/users"
        />
        <KpiCard
          icon={HardHat}
          tone="sky"
          label="Profissionais"
          value={o ? formatNumber(o.totalTaskers) : failed ? "—" : undefined}
          delta={s ? s.growth.newProfessionals : undefined}
          hint={s ? `${formatNumber(s.current.newProfessionals)} novos no período` : undefined}
          href="/professionals"
        />
        <KpiCard
          icon={CalendarClock}
          tone="navy"
          label="Solicitações de serviço"
          value={s ? formatNumber(s.current.tasksCreated) : failed ? "—" : undefined}
          delta={s ? s.growth.tasksCreated : undefined}
          hint={s ? "criadas no período" : undefined}
          href="/requests"
        />
        <KpiCard
          icon={TrendingUp}
          tone="success"
          label="Volume transacionado"
          value={s ? formatBRL(s.current.gmv) : failed ? "—" : undefined}
          delta={s ? s.growth.gmv : undefined}
          hint={s ? "pagamentos confirmados" : undefined}
          href="/finance"
        />
      </div>
      {failed && (
        <p role="alert" className="text-sm text-rose-600">
          Não foi possível carregar alguns indicadores.{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => {
              overview.refetch();
              summary.refetch();
            }}
          >
            Tentar de novo
          </button>
        </p>
      )}
    </div>
  );
}

/** Tasks created per bucket (area) + status distribution (donut). */
export function DashboardRequests({ period }: { period: Period }) {
  const summary = useReportsSummary(period);
  const series = useReportsSeries(period);
  const status = useTaskStatusCounts(period);

  const points =
    series.data?.points.map((p) => ({ label: bucketLabel(p.bucket, series.data?.granularity ?? "day"), value: p.tasks })) ?? [];

  const c = status.data?.counts;
  const donut = c
    ? [
        { label: "Concluídas", value: c.COMPLETED + c.RELEASED, color: CHART_COLORS.success },
        { label: "Em andamento", value: c.ACCEPTED + c.IN_PROGRESS, color: CHART_COLORS.sky },
        { label: "Aguardando", value: c.OPEN, color: CHART_COLORS.warning },
        { label: "Canceladas", value: c.CANCELLED, color: CHART_COLORS.neutral },
        { label: "Em disputa", value: c.DISPUTED, color: CHART_COLORS.danger },
      ]
    : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <ChartCard
        title="Solicitações de serviços"
        description={periodLabel(period)}
        value={summary.data ? formatNumber(summary.data.current.tasksCreated) : undefined}
        delta={summary.data ? summary.data.growth.tasksCreated : undefined}
        action={
          <Link href="/requests" className="text-xs font-semibold text-sky hover:underline">
            Ver solicitações
          </Link>
        }
      >
        <ChartBody loading={series.isLoading} error={series.error?.message} onRetry={() => series.refetch()}>
          <AreaChart data={points} formatValue={formatNumber} seriesLabels={["Solicitações"]} />
        </ChartBody>
      </ChartCard>

      <ChartCard title="Status das solicitações" description={`Criadas · ${periodLabel(period).toLowerCase()}`}>
        <ChartBody loading={status.isLoading} error={status.error?.message} onRetry={() => status.refetch()} height={168}>
          {status.data && status.data.total === 0 ? (
            <div className="flex h-[168px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
              Nenhuma solicitação no período
            </div>
          ) : (
            <DonutChart data={donut} centerLabel="solicitações" formatValue={formatNumber} />
          )}
        </ChartBody>
      </ChartCard>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  href,
  highlight,
}: {
  icon: LucideIcon;
  tone: CardTone;
  label: string;
  value: string | undefined;
  hint?: React.ReactNode;
  href: string;
  highlight?: boolean;
}) {
  const toneClass: Record<CardTone, string> = {
    brand: "bg-brand-soft text-brand",
    navy: "bg-navy-50 text-navy",
    sky: "bg-sky-soft text-sky",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-rose-50 text-rose-600",
  };
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneClass[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-muted-foreground">{label}</span>
          {hint && <span className="block truncate text-2xs text-muted-foreground">{hint}</span>}
        </span>
        {value === undefined ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <span className={cn("text-base font-extrabold tabular-nums", highlight ? "text-rose-600" : "text-navy")}>{value}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </Link>
    </li>
  );
}

/** GMV / revenue chart + operational summary links. */
export function DashboardRevenue({ period }: { period: Period }) {
  const summary = useReportsSummary(period);
  const series = useReportsSeries(period);
  const overview = useDashboardOverview();
  const o = overview.data;
  const s = summary.data;

  const points =
    series.data?.points.map((p) => ({
      label: bucketLabel(p.bucket, series.data?.granularity ?? "day"),
      value: p.gmv,
      secondary: p.revenue,
    })) ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <ChartCard
        title="Faturamento"
        description="Volume transacionado (GMV) e receita da plataforma"
        value={s ? formatBRL(s.current.gmv) : undefined}
        delta={s ? s.growth.gmv : undefined}
        action={
          <Link href="/reports" className="text-xs font-semibold text-sky hover:underline">
            Ver relatórios
          </Link>
        }
      >
        <ChartBody loading={series.isLoading} error={series.error?.message} onRetry={() => series.refetch()}>
          <AreaChart data={points} formatValue={formatBRL} seriesLabels={["Volume (GMV)", "Receita"]} />
        </ChartBody>
      </ChartCard>

      <SectionCard title="Resumo financeiro e operação" contentClassName="px-3 pb-3 pt-2">
        <ul className="divide-y divide-border/60">
          <SummaryRow
            icon={Wallet}
            tone="brand"
            label="Receita da plataforma"
            hint={
              s ? (
                <span className="inline-flex items-center gap-1">
                  no período <Delta value={s.growth.platformRevenue} className="text-2xs" />
                </span>
              ) : undefined
            }
            value={s ? formatBRL(s.current.platformRevenue) : undefined}
            href="/reports"
          />
          <SummaryRow
            icon={Banknote}
            tone="sky"
            label="Repasses a profissionais"
            hint="liberados · todo o período"
            value={o ? formatBRL(o.taskerPayouts) : undefined}
            href="/finance"
          />
          <SummaryRow
            icon={CheckCircle2}
            tone="success"
            label="Taxa de conclusão"
            hint="concluídas / não canceladas"
            value={o ? formatPercent(o.completionRate) : undefined}
            href="/requests"
          />
          <SummaryRow
            icon={Scale}
            tone="danger"
            label="Disputas abertas"
            value={o ? formatNumber(o.openDisputes) : undefined}
            highlight={!!o && o.openDisputes > 0}
            href="/disputes"
          />
          <SummaryRow
            icon={Banknote}
            tone="warning"
            label="Saques pendentes"
            value={o ? formatNumber(o.pendingWithdrawals) : undefined}
            href="/finance/withdrawals"
          />
        </ul>
      </SectionCard>
    </div>
  );
}

/** All-time task funnel + growth in the period. */
export function DashboardFunnel({ period }: { period: Period }) {
  const funnel = useTaskFunnel();
  const summary = useReportsSummary(period);
  const f = funnel.data;
  const s = summary.data;

  const growthRows = [
    { label: "Novos usuários", value: s?.current.newUsers, delta: s?.growth.newUsers },
    { label: "Novos profissionais", value: s?.current.newProfessionals, delta: s?.growth.newProfessionals },
    { label: "Solicitações criadas", value: s?.current.tasksCreated, delta: s?.growth.tasksCreated },
    { label: "Solicitações concluídas", value: s?.current.tasksCompleted, delta: s?.growth.tasksCompleted },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <SectionCard title="Funil de serviços" description="Todas as solicitações por etapa (todo o período)">
        <ChartBody loading={funnel.isLoading} error={funnel.error?.message} onRetry={() => funnel.refetch()} height={200}>
          {f && (
            <HBarChart
              color={CHART_COLORS.brand}
              formatValue={formatNumber}
              data={[
                { label: "Aguardando", value: f.open },
                { label: "Aceitas", value: f.accepted },
                { label: "Em andamento", value: f.inProgress },
                { label: "Concluídas", value: f.completed },
                { label: "Finalizadas (pagas)", value: f.released },
                { label: "Canceladas", value: f.cancelled },
                { label: "Em disputa", value: f.disputed },
              ]}
            />
          )}
        </ChartBody>
      </SectionCard>

      <SectionCard title="Crescimento no período" description={`${periodLabel(period)} vs. período anterior`}>
        <ul className="space-y-3">
          {growthRows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-3">
                {r.value === undefined ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  <b className="text-base font-extrabold tabular-nums text-navy">{formatNumber(r.value)}</b>
                )}
                {r.delta !== undefined && <Delta value={r.delta} />}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
