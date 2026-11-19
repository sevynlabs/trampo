import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";

/**
 * Professionals data hooks — the single point where /professionals touches the API.
 * Block/unblock and role changes reuse the user mutations (features/users/api.ts).
 */

export type ProfessionalsListInput = RouterInputs["admin"]["listProfessionals"];
export type ProfessionalsList = RouterOutputs["admin"]["listProfessionals"];
export type ProfessionalRow = ProfessionalsList["professionals"][number];
export type ProfessionalStatusFilter = NonNullable<ProfessionalsListInput["status"]>;
export type ProfessionalSortBy = NonNullable<ProfessionalsListInput["sortBy"]>;
export const PROFESSIONAL_SORT_KEYS: readonly ProfessionalSortBy[] = ["createdAt", "name", "rating", "totalTasks"];
export type ServiceCategory = RouterOutputs["admin"]["services"]["list"][number];

export function useProfessionalsList(params: ProfessionalsListInput) {
  return trpc.admin.listProfessionals.useQuery(params, { placeholderData: keepPreviousData });
}

/** Categories for the "Categoria" filter (admin.services.list). */
export function useServiceCategories() {
  return trpc.admin.services.list.useQuery({}, { staleTime: 5 * 60_000 });
}

/**
 * userId → taskerProfile id for profiles awaiting review. `listProfessionals`
 * returns the user id only, and the review page (/kyc/[profileId]) needs the
 * profile id, so we join with the KYC queue.
 */
export function usePendingKycProfileIds() {
  const q = trpc.admin.listPendingKyc.useQuery();
  const map = useMemo(() => new Map((q.data ?? []).map((p) => [p.userId, p.profileId])), [q.data]);
  return { map, isLoading: q.isLoading };
}
