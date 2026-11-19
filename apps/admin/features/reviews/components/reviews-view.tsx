"use client";

import { useMemo, useState } from "react";
import { EyeOff, MessageSquareText, Minus, ShieldAlert, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  ConfirmDialog,
  DataTable,
  FilterBar,
  FilterSelect,
  InfoCard,
  PageHeader,
  PeriodSelect,
  SearchInput,
  SectionCard,
  StatCard,
} from "@/components/ds";
import { useUrlState } from "@/hooks/use-url-state";
import { isPeriod, type Period } from "@/constants/period";
import { formatNumber } from "@/lib/format";
import { useAdminRole } from "@/hooks/use-admin-role";
import { useHideReview, useReviewStats, useReviews, useUnhideReview, type ReviewListInput, type ReviewRow } from "../api";
import { buildReviewColumns } from "./review-columns";
import { ReviewSheet } from "./review-sheet";

const RATING_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "5", label: "5 estrelas" },
  { value: "4", label: "4 estrelas" },
  { value: "3", label: "3 estrelas" },
  { value: "2", label: "2 estrelas" },
  { value: "1", label: "1 estrela" },
];

const VISIBILITY_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "visible", label: "Visíveis" },
  { value: "hidden", label: "Ocultas" },
];

type Pending = { mode: "hide" | "unhide"; review: ReviewRow } | null;

export function ReviewsView() {
  const [s, set] = useUrlState({
    q: "",
    page: "1",
    rating: "all",
    visibility: "all",
    period: "30d",
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const period: Period = isPeriod(s.period) ? s.period : "30d";
  const page = Math.max(1, Number(s.page) || 1);

  const input: ReviewListInput = {
    page,
    pageSize: 20,
    search: s.q || undefined,
    rating: s.rating === "all" ? "all" : Number(s.rating),
    visibility: s.visibility as "all" | "visible" | "hidden",
    period,
    sortBy: s.sortBy === "rating" ? "rating" : "createdAt",
    sortDir: s.sortDir === "asc" ? "asc" : "desc",
  };

  const stats = useReviewStats(period);
  const list = useReviews(input);

  const [selected, setSelected] = useState<ReviewRow | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const close = () => {
    setPending(null);
    setSelected(null);
  };
  const { readOnlyReason } = useAdminRole();
  const hide = useHideReview(close);
  const unhide = useUnhideReview(close);

  const columns = useMemo(
    () =>
      buildReviewColumns({
        onView: setSelected,
        onHide: (review) => setPending({ mode: "hide", review }),
        onUnhide: (review) => setPending({ mode: "unhide", review }),
        readOnlyReason,
      }),
    [readOnlyReason]
  );

  const st = stats.data;
  const pct = (n: number) => (st && st.total > 0 ? ` · ${Math.round((n / st.total) * 100)}%` : "");

  return (
    <div className="space-y-6">
      <PageHeader title="Avaliações" description="Acompanhe a reputação da plataforma e modere avaliações." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Star}
          tone="warning"
          label={`Avaliação média${st ? ` · ${formatNumber(st.total)} no período` : ""}`}
          value={st ? (st.averageRating > 0 ? st.averageRating.toFixed(1).replace(".", ",") : "—") : undefined}
        />
        <StatCard icon={ThumbsUp} tone="success" label={`Positivas (4–5)${st ? pct(st.positive) : ""}`} value={st ? formatNumber(st.positive) : undefined} />
        <StatCard icon={Minus} tone="sky" label={`Neutras (3)${st ? pct(st.neutral) : ""}`} value={st ? formatNumber(st.neutral) : undefined} />
        <StatCard icon={ThumbsDown} tone="danger" label={`Negativas (1–2)${st ? pct(st.negative) : ""}`} value={st ? formatNumber(st.negative) : undefined} />
        <StatCard icon={EyeOff} tone="navy" label="Ocultas pela moderação" value={st ? formatNumber(st.hidden) : undefined} />
      </div>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <SearchInput
              value={s.q}
              onChange={(v) => set({ q: v })}
              placeholder="Buscar por comentário, pessoa, serviço ou código"
            />
            <PeriodSelect value={period} onChange={(p) => set({ period: p })} />
            <FilterSelect label="Nota" value={s.rating} onChange={(v) => set({ rating: v })} options={RATING_OPTIONS} />
            <FilterSelect
              label="Visibilidade"
              value={s.visibility}
              onChange={(v) => set({ visibility: v })}
              options={VISIBILITY_OPTIONS}
            />
          </FilterBar>

          <DataTable
            columns={columns}
            data={list.data?.items}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(r) => r.id}
            onRowClick={setSelected}
            rowLabel={(r) => `Avaliação de ${r.reviewer.name ?? "usuário"}, nota ${r.rating}`}
            empty={{
              icon: MessageSquareText,
              title: "Nenhuma avaliação encontrada",
              description: "Ajuste os filtros ou o período para ver mais resultados.",
            }}
            pagination={{
              page,
              pageSize: 20,
              total: list.data?.total ?? 0,
              onPageChange: (p) => set({ page: String(p) }, { resetPage: false }),
            }}
            sorting={{
              sortBy: input.sortBy,
              sortDir: input.sortDir,
              onChange: (by, dir) => set({ sortBy: by, sortDir: dir }),
            }}
          />
        </div>
      </SectionCard>

      <InfoCard icon={ShieldAlert} title="Como funciona a moderação" tone="navy">
        Ocultar uma avaliação a remove do app (perfil e listagens) e recalcula a nota média do profissional. O motivo fica
        registrado na auditoria e a avaliação pode ser reexibida a qualquer momento.
      </InfoCard>

      <ReviewSheet
        review={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onHide={(review) => setPending({ mode: "hide", review })}
        onUnhide={(review) => setPending({ mode: "unhide", review })}
        readOnlyReason={readOnlyReason}
      />

      <ConfirmDialog
        open={pending?.mode === "hide"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Ocultar avaliação?"
        description="A avaliação deixa de aparecer no app e a nota média do profissional é recalculada. Informe o motivo para a auditoria."
        confirmLabel="Ocultar avaliação"
        tone="danger"
        requireReason
        reasonLabel="Motivo da ocultação"
        reasonPlaceholder="Ex.: linguagem ofensiva, dados pessoais, avaliação falsa…"
        loading={hide.isPending}
        onConfirm={(reason) => pending && hide.mutate({ id: pending.review.id, reason: reason ?? "" })}
      />
      <ConfirmDialog
        open={pending?.mode === "unhide"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Reexibir avaliação?"
        description="A avaliação volta a aparecer no app e a nota média do profissional é recalculada."
        confirmLabel="Reexibir"
        loading={unhide.isPending}
        onConfirm={() => pending && unhide.mutate({ id: pending.review.id })}
      />
    </div>
  );
}
