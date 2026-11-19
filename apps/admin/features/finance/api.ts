"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";
import type { Period } from "@/constants/period";
import { useExportCsv } from "@/features/requests/api";

/** Pagamentos & saques. Single point of contact with `admin.finance.*`. */
export type PaymentListInput = RouterInputs["admin"]["finance"]["listPayments"];
export type PaymentRow = RouterOutputs["admin"]["finance"]["listPayments"]["payments"][number];
export type PaymentDetail = RouterOutputs["admin"]["finance"]["getPayment"];
export type PaymentStatusFilter = NonNullable<PaymentListInput["status"]>;
export type WithdrawalListInput = RouterInputs["admin"]["finance"]["listWithdrawals"];
export type WithdrawalRow = RouterOutputs["admin"]["finance"]["listWithdrawals"]["withdrawals"][number];
export type WithdrawalStatusFilter = NonNullable<WithdrawalListInput["status"]>;

/** Finance endpoints take `days` (1..365) instead of `period`. */
export function periodToDays(p: Period): number | undefined {
  return { "7d": 7, "30d": 30, "90d": 90, "12m": 365, all: undefined }[p];
}

/** Short human id, same format as the API's task code ("#A1B2C3D4"). */
export function shortId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function usePayments(input: PaymentListInput) {
  return trpc.admin.finance.listPayments.useQuery(input, { placeholderData: keepPreviousData });
}

export function usePayment(id: string | null) {
  return trpc.admin.finance.getPayment.useQuery({ id: id ?? "" }, { enabled: !!id });
}

/** Revenue KPIs. revenueReport caps at 365 days, so "Todo o período" uses 12 months. */
export function useRevenueReport(period: Period) {
  return trpc.admin.finance.revenueReport.useQuery(
    { days: periodToDays(period) ?? 365 },
    { placeholderData: keepPreviousData }
  );
}

/** Pending withdrawals: count (`total`) + amount (`pendingTotal`). */
export function usePendingWithdrawals() {
  return trpc.admin.finance.listWithdrawals.useQuery({ status: "PENDING", page: 1, pageSize: 1 });
}

export function useWithdrawals(input: WithdrawalListInput) {
  return trpc.admin.finance.listWithdrawals.useQuery(input, { placeholderData: keepPreviousData });
}

export function usePayWithdrawal(opts?: { onSuccess?: () => void }) {
  const utils = trpc.useUtils();
  return trpc.admin.finance.payWithdrawal.useMutation({
    onSuccess: () => {
      toast.success("Saque marcado como pago");
      utils.admin.finance.listWithdrawals.invalidate();
      opts?.onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Não foi possível registrar o pagamento"),
  });
}

export function useRejectWithdrawal(opts?: { onSuccess?: () => void }) {
  const utils = trpc.useUtils();
  return trpc.admin.finance.rejectWithdrawal.useMutation({
    onSuccess: () => {
      toast.success("Saque rejeitado");
      utils.admin.finance.listWithdrawals.invalidate();
      opts?.onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Não foi possível rejeitar o saque"),
  });
}

export const useExportPaymentsCsv = () => useExportCsv("payments");
