"use client";

import {
  Users,
  UserPlus,
  Wallet,
  TrendingUp,
  Activity,
  Scale,
  CheckCircle2,
  Banknote,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, BarChart, DonutChart } from "@/components/ui/charts";
import {
  formatBRL,
  formatNumber,
  formatPercent,
  formatDayLabel,
} from "@/lib/format";

export default function DashboardPage() {
  const overview = trpc.admin.dashboard.overview.useQuery();
  const revenue = trpc.admin.dashboard.revenueSeries.useQuery({ days: 30 });
  const users = trpc.admin.dashboard.usersSeries.useQuery({ days: 30 });
  const funnel = trpc.admin.dashboard.taskFunnel.useQuery();

  const o = overview.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da plataforma — últimos 30 dias</p>
      </div>

      {overview.isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar as métricas. Tente novamente.
        </p>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="GMV (volume transacionado)"
          value={o ? formatBRL(o.gmv) : undefined}
          icon={TrendingUp}
        />
        <StatCard
          label="Receita da plataforma"
          value={o ? formatBRL(o.platformRevenue) : undefined}
          icon={Wallet}
          hint="Comissão (15% + 5%)"
        />
        <StatCard
          label="Repasses a profissionais"
          value={o ? formatBRL(o.taskerPayouts) : undefined}
          icon={Banknote}
        />
        <StatCard
          label="Taxa de conclusão"
          value={o ? formatPercent(o.completionRate) : undefined}
          icon={CheckCircle2}
        />
        <StatCard
          label="Usuários totais"
          value={o ? formatNumber(o.totalUsers) : undefined}
          icon={Users}
          href="/users"
        />
        <StatCard
          label="Novos (30d)"
          value={o ? formatNumber(o.newUsers30d) : undefined}
          icon={UserPlus}
        />
        <StatCard
          label="Serviços ativos"
          value={o ? formatNumber(o.activeTasks) : undefined}
          icon={Activity}
        />
        <StatCard
          label="Disputas abertas"
          value={o ? formatNumber(o.openDisputes) : undefined}
          icon={Scale}
          highlight={!!o && o.openDisputes > 0}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Receita diária</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={(revenue.data ?? []).map((d) => ({
                label: formatDayLabel(d.day),
                value: d.revenue,
              }))}
              formatValue={formatBRL}
              className="text-sky"
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Novos usuários por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={(users.data ?? []).map((d) => ({
                label: formatDayLabel(d.day),
                value: d.count,
              }))}
              formatValue={formatNumber}
            />
          </CardContent>
        </Card>
      </div>

      {/* Status + funnel */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Status dos serviços</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.data && (
              <DonutChart
                centerLabel="serviços"
                data={[
                  { label: "Concluídos", value: funnel.data.completed + funnel.data.released, color: "#FF6A00" },
                  { label: "Em andamento", value: funnel.data.accepted + funnel.data.inProgress, color: "#0096D6" },
                  { label: "Abertos", value: funnel.data.open, color: "#041E42" },
                  { label: "Cancelados", value: funnel.data.cancelled, color: "#CBD5E1" },
                  { label: "Em disputa", value: funnel.data.disputed, color: "#E11D48" },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Funil de serviços</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.data && (
              <BarChart
                formatValue={formatNumber}
                data={[
                  { label: "Abertos", value: funnel.data.open },
                  { label: "Aceitos", value: funnel.data.accepted },
                  { label: "Em andamento", value: funnel.data.inProgress },
                  { label: "Concluídos", value: funnel.data.completed },
                  { label: "Liberados (pagos)", value: funnel.data.released },
                  { label: "Cancelados", value: funnel.data.cancelled, tone: "muted" },
                  { label: "Em disputa", value: funnel.data.disputed, tone: "danger" },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
