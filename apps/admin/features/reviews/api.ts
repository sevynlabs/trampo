"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";
import type { Period } from "@/constants/period";

/** Data layer of "Avaliações" — the only place that talks to admin.reviews.*. */

export type ReviewListInput = RouterInputs["admin"]["reviews"]["list"];
export type ReviewList = RouterOutputs["admin"]["reviews"]["list"];
export type ReviewRow = ReviewList["items"][number];
export type ReviewStats = RouterOutputs["admin"]["reviews"]["stats"];

export function useReviewStats(period: Period) {
  return trpc.admin.reviews.stats.useQuery({ period });
}

export function useReviews(input: ReviewListInput) {
  return trpc.admin.reviews.list.useQuery(input, { placeholderData: keepPreviousData });
}

function useInvalidateReviews() {
  const utils = trpc.useUtils();
  return () => Promise.all([utils.admin.reviews.list.invalidate(), utils.admin.reviews.stats.invalidate()]);
}

export function useHideReview(onDone?: () => void) {
  const invalidate = useInvalidateReviews();
  return trpc.admin.reviews.hide.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Avaliação ocultada", { description: "A nota do profissional foi recalculada." });
      onDone?.();
    },
    onError: (e) => toast.error("Não foi possível ocultar", { description: e.message }),
  });
}

export function useUnhideReview(onDone?: () => void) {
  const invalidate = useInvalidateReviews();
  return trpc.admin.reviews.unhide.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Avaliação reexibida", { description: "A nota do profissional foi recalculada." });
      onDone?.();
    },
    onError: (e) => toast.error("Não foi possível reexibir", { description: e.message }),
  });
}

/** Who is the client / professional for a review, given its direction. */
export function reviewParties(r: ReviewRow) {
  return r.direction === "CLIENT_TO_PRO"
    ? { client: r.reviewer, professional: r.reviewee }
    : { client: r.reviewee, professional: r.reviewer };
}

export const DIRECTION_LABEL: Record<ReviewRow["direction"], string> = {
  CLIENT_TO_PRO: "Cliente → Profissional",
  PRO_TO_CLIENT: "Profissional → Cliente",
};
