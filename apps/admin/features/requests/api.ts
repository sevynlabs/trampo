"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";
import type { Period } from "@/constants/period";

/** Solicitações (tasks). Single point of contact with `admin.requests.*`. */
export type RequestListInput = RouterInputs["admin"]["requests"]["list"];
export type RequestList = RouterOutputs["admin"]["requests"]["list"];
export type RequestRow = RequestList["items"][number];
export type RequestDetail = RouterOutputs["admin"]["requests"]["get"];
export type RequestStatusCounts = RouterOutputs["admin"]["requests"]["statusCounts"];
export type RequestSortBy = NonNullable<RequestListInput["sortBy"]>;
export type TaskStatusFilter = NonNullable<RequestListInput["status"]>;
export type TaskStatus = NonNullable<RequestListInput["statuses"]>[number];

export const REQUEST_SORT_KEYS: readonly RequestSortBy[] = ["createdAt", "totalValue", "scheduledAt"];

export function useRequests(input: RequestListInput) {
  return trpc.admin.requests.list.useQuery(input, { placeholderData: keepPreviousData });
}

export function useRequest(id: string | null) {
  return trpc.admin.requests.get.useQuery({ id: id ?? "" }, { enabled: !!id });
}

export function useRequestStatusCounts(period: Period) {
  return trpc.admin.requests.statusCounts.useQuery({ period }, { placeholderData: keepPreviousData });
}

/** Categories for the "Categoria" filter (reuses the services endpoint). */
export function useRequestCategories() {
  return trpc.admin.services.list.useQuery({ status: "all" }, { staleTime: 5 * 60_000 });
}

export function useCancelRequest(opts?: { onSuccess?: () => void }) {
  const utils = trpc.useUtils();
  return trpc.admin.requests.cancel.useMutation({
    onSuccess: (_r, vars) => {
      toast.success("Solicitação cancelada");
      utils.admin.requests.list.invalidate();
      utils.admin.requests.statusCounts.invalidate();
      utils.admin.requests.get.invalidate({ id: vars.id });
      opts?.onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Não foi possível cancelar a solicitação"),
  });
}

/** Downloads `admin.reports.exportCsv` ({ filename, csv }) as a file. */
export function useExportCsv(kind: RouterInputs["admin"]["reports"]["exportCsv"]["kind"]) {
  const utils = trpc.useUtils();
  const [pending, setPending] = useState(false);
  const run = async (period: Period) => {
    setPending(true);
    try {
      const { filename, csv } = await utils.admin.reports.exportCsv.fetch({ period, kind }, { staleTime: 0 });
      // The API already prefixes the UTF-8 BOM (Excel-friendly).
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success("Exportação concluída", { description: filename });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível exportar");
    } finally {
      setPending(false);
    }
  };
  return { run, pending };
}

export const useExportRequestsCsv = () => useExportCsv("requests");
