"use client";

import { trpc, type RouterOutputs } from "@/lib/trpc";
import type { Period } from "@/constants/period";

/**
 * Dashboard data hooks — the single point where the home screen touches the API.
 * Period-aware numbers come from `admin.reports.*` / `admin.requests.statusCounts`;
 * "all-time" headline numbers come from `admin.dashboard.overview`.
 */

export type DashboardOverview = RouterOutputs["admin"]["dashboard"]["overview"];
export type ReportsSummary = RouterOutputs["admin"]["reports"]["summary"];
export type ReportsSeries = RouterOutputs["admin"]["reports"]["revenueSeries"];
export type TaskStatusCounts = RouterOutputs["admin"]["requests"]["statusCounts"];
export type TaskFunnel = RouterOutputs["admin"]["dashboard"]["taskFunnel"];

/** All-time totals: users, taskers, GMV, revenue, payouts, completion rate, disputes, withdrawals. */
export function useDashboardOverview() {
  return trpc.admin.dashboard.overview.useQuery();
}

/** Period totals + growth vs. the previous window of equal length. */
export function useReportsSummary(period: Period) {
  return trpc.admin.reports.summary.useQuery({ period });
}

/** GMV / revenue / tasks per bucket (day, week or month depending on the period). */
export function useReportsSeries(period: Period) {
  return trpc.admin.reports.revenueSeries.useQuery({ period });
}

/** Tasks created in the period, grouped by status. */
export function useTaskStatusCounts(period: Period) {
  return trpc.admin.requests.statusCounts.useQuery({ period });
}

/** All-time task counts per lifecycle step. */
export function useTaskFunnel() {
  return trpc.admin.dashboard.taskFunnel.useQuery();
}
