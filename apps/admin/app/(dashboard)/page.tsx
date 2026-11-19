"use client";

import { Suspense } from "react";
import { LoadingState, PageHeader } from "@/components/ds";
import { usePeriod } from "@/hooks/use-url-state";
import { periodLabel } from "@/constants/period";
import {
  DashboardFunnel,
  DashboardKpis,
  DashboardRequests,
  DashboardRevenue,
} from "@/features/dashboard/components/dashboard-sections";

function Dashboard() {
  const [period] = usePeriod();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Visão geral da plataforma · ${periodLabel(period).toLowerCase()} (altere o período no topo)`}
      />
      <DashboardKpis period={period} />
      <DashboardRequests period={period} />
      <DashboardRevenue period={period} />
      <DashboardFunnel period={period} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <Dashboard />
    </Suspense>
  );
}
