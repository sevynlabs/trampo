"use client";

import Link from "next/link";
import { Users, UserCheck, ShieldAlert, Activity, Scale } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type StatCardProps = {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  highlight?: boolean;
};

function StatCard({ label, value, icon: Icon, href, highlight }: StatCardProps) {
  const body = (
    <Card className={highlight && value ? "border-primary/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold">{value.toLocaleString("pt-BR")}</div>
        )}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  const stats = trpc.admin.dashboardStats.useQuery();
  const d = stats.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da plataforma TRAMPO</p>
      </div>

      {stats.isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar as métricas. Tente novamente.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Usuários totais"
          value={d?.totalUsers}
          icon={Users}
          href="/users"
        />
        <StatCard
          label="Profissionais"
          value={d?.totalTaskers}
          icon={UserCheck}
          href="/users"
        />
        <StatCard
          label="KYC pendentes"
          value={d?.kycPending}
          icon={ShieldAlert}
          href="/kyc"
          highlight
        />
        <StatCard label="Trampos ativos" value={d?.activeTasks} icon={Activity} />
        <StatCard
          label="Disputas abertas"
          value={d?.openDisputes}
          icon={Scale}
          highlight
        />
      </div>
    </div>
  );
}
