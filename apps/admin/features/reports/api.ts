"use client";

import { useState } from "react";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";
import { formatNumber } from "@/lib/format";
import type { Period } from "@/constants/period";

/** Data layer of "Relatórios" — the only place that talks to admin.reports.*. */

export type ReportSummary = RouterOutputs["admin"]["reports"]["summary"];
export type Granularity = RouterOutputs["admin"]["reports"]["revenueSeries"]["granularity"];
export type ExportKind = RouterInputs["admin"]["reports"]["exportCsv"]["kind"];

export const EXPORT_KINDS: { kind: ExportKind; label: string; description: string }[] = [
  { kind: "payments", label: "Pagamentos", description: "Valores, taxas, repasses e status" },
  { kind: "requests", label: "Solicitações", description: "Serviços, clientes, profissionais e valores" },
  { kind: "users", label: "Usuários", description: "Cadastros, perfis e verificação" },
];

export function useReportSummary(period: Period) {
  return trpc.admin.reports.summary.useQuery({ period });
}

export function useRevenueSeries(period: Period) {
  return trpc.admin.reports.revenueSeries.useQuery({ period });
}

export function useByCategory(period: Period) {
  return trpc.admin.reports.byCategory.useQuery({ period });
}

export function useUsersSeries(period: Period) {
  return trpc.admin.reports.usersSeries.useQuery({ period });
}

/** Fetches the CSV through tRPC and triggers a browser download (csv already has the BOM). */
export function useExportCsv(period: Period) {
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<ExportKind | null>(null);

  async function exportCsv(kind: ExportKind) {
    setPending(kind);
    try {
      const res = await utils.admin.reports.exportCsv.fetch({ period, kind }, { staleTime: 0 });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const label = EXPORT_KINDS.find((k) => k.kind === kind)?.label ?? kind;
      if (res.truncated) {
        toast.warning(`${label}: exportação limitada a ${formatNumber(res.rows)} linhas`, {
          description: "Escolha um período menor para obter todos os registros.",
        });
      } else {
        toast.success(`${label} exportados`, { description: `${formatNumber(res.rows)} linha(s) em ${res.filename}` });
      }
    } catch (e) {
      toast.error("Não foi possível exportar", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPending(null);
    }
  }

  return { exportCsv, pending };
}

const MONTH_FMT = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Bucket key ("YYYY-MM-DD", UTC) → axis label for the series granularity. */
export function bucketLabel(bucket: string, granularity: Granularity): string {
  const [y, m, d] = bucket.split("-");
  if (granularity === "day") return `${d}/${m}`;
  if (granularity === "week") return `sem ${d}/${m}`;
  const parts = MONTH_FMT.formatToParts(new Date(Date.UTC(Number(y), Number(m) - 1, 1)));
  const month = (parts.find((p) => p.type === "month")?.value ?? m).replace(".", "");
  const year = parts.find((p) => p.type === "year")?.value ?? y.slice(2);
  return `${month}/${year}`;
}
