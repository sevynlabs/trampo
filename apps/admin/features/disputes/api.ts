"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";

/** Data layer of "Disputas" — the only place that talks to admin.disputes.*. */

export type DisputeListInput = RouterInputs["admin"]["disputes"]["list"];
export type DisputeRow = RouterOutputs["admin"]["disputes"]["list"]["items"][number];
export type DisputeDetail = RouterOutputs["admin"]["disputes"]["get"];
export type DisputeStats = RouterOutputs["admin"]["disputes"]["stats"];
export type DisputeOutcome = RouterInputs["admin"]["disputes"]["resolve"]["outcome"];

export function useDisputes(input: DisputeListInput) {
  return trpc.admin.disputes.list.useQuery(input, { placeholderData: keepPreviousData });
}

export function useDispute(id: string | null) {
  return trpc.admin.disputes.get.useQuery({ id: id ?? "" }, { enabled: !!id });
}

export function useDisputeStats() {
  return trpc.admin.disputes.stats.useQuery();
}

export function useResolveDispute(onDone?: () => void) {
  const utils = trpc.useUtils();
  return trpc.admin.disputes.resolve.useMutation({
    onSuccess: async (_data, vars) => {
      await Promise.all([
        utils.admin.disputes.list.invalidate(),
        utils.admin.disputes.get.invalidate({ id: vars.id }),
        utils.admin.disputes.stats.invalidate(),
      ]);
      toast.success("Disputa resolvida", {
        description:
          vars.outcome === "RELEASE" ? "O pagamento foi liberado ao profissional." : "O valor foi reembolsado ao cliente.",
      });
      onDone?.();
    },
    onError: (e) => toast.error("Não foi possível resolver a disputa", { description: e.message }),
  });
}

export const OPENED_BY_LABEL: Record<DisputeRow["openedBy"], string> = {
  CLIENT: "Aberta pelo cliente",
  TASKER: "Aberta pelo profissional",
  UNKNOWN: "Aberta pela plataforma",
};
