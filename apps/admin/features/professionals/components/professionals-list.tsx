"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, HardHat, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, DisabledHint, FilterBar, FilterSelect, PageHeader, SearchInput, SectionCard } from "@/components/ds";
import { useUrlState } from "@/hooks/use-url-state";
import { useAdminRole } from "@/hooks/use-admin-role";
import { formatNumber } from "@/lib/format";
import { UserDrawer } from "@/features/users/components/user-summary";
import { UserActiveDialog, type ActiveTarget } from "@/features/users/components/user-active-dialog";
import { InviteDialog } from "@/features/users/components/invite-dialog";
import {
  PROFESSIONAL_SORT_KEYS,
  usePendingKycProfileIds,
  useProfessionalsList,
  useServiceCategories,
  type ProfessionalRow,
  type ProfessionalSortBy,
  type ProfessionalStatusFilter,
} from "../api";
import { CategoryTags, professionalColumns } from "./professional-columns";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: ProfessionalStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Verificados" },
  { value: "verification", label: "Pendentes / sem verificação" },
  { value: "rejected", label: "Rejeitados" },
  { value: "blocked", label: "Suspensos" },
];

const PRO_INVITE_TEXT =
  "Oi! Que tal oferecer seus serviços no TRAMPO? Baixe o app TRAMPO na loja do seu celular (Google Play ou App Store) e crie sua conta com o número do celular. " +
  "Depois, no Perfil, toque em \"Conta profissional\", escolha os serviços que você faz e envie a verificação. " +
  "Assim que for aprovado, você já começa a receber pedidos de clientes perto de você.";

/** Profissionais: filters + server-paginated table + profile drawer. */
export function ProfessionalsList() {
  const router = useRouter();
  const [s, set] = useUrlState({ q: "", page: "1", status: "all", category: "", sortBy: "createdAt", sortDir: "desc" });
  const page = Math.max(1, Number(s.page) || 1);
  const status = (STATUS_OPTIONS.some((o) => o.value === s.status) ? s.status : "all") as ProfessionalStatusFilter;
  const sortBy: ProfessionalSortBy = (PROFESSIONAL_SORT_KEYS as readonly string[]).includes(s.sortBy)
    ? (s.sortBy as ProfessionalSortBy)
    : "createdAt";
  const sortDir = s.sortDir === "asc" ? "asc" : "desc";
  const { canEdit, readOnlyReason } = useAdminRole();

  const categories = useServiceCategories();
  const q = s.q.trim();
  // Only a uuid reaches the API (its input is z.string().uuid()).
  const categoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.category) ? s.category : undefined;

  const query = useProfessionalsList({ page, pageSize: PAGE_SIZE, search: q || undefined, status, categoryId, sortBy, sortDir });
  const pending = usePendingKycProfileIds();

  const [view, setView] = useState<ProfessionalRow | null>(null);
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const columns = useMemo(
    () =>
      professionalColumns({
        onView: (p) => setView(p),
        onEdit: (p) => router.push(`/users/${p.id}`),
        onToggleActive: (p) => setActiveTarget({ id: p.id, name: p.name, isActive: p.isActive }),
        reviewProfileId: (p) => pending.map.get(p.id),
        onReview: (profileId) => router.push(`/kyc/${profileId}`),
        readOnlyReason,
      }),
    [router, pending.map, readOnlyReason]
  );

  const categoryOptions = [
    { value: "all", label: "Todas" },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${formatNumber(c.professionalsCount)})` })),
  ];

  const data = query.data;
  const hasFilters = !!q || status !== "all" || !!categoryId;
  const viewReviewId = view && view.kycStatus === "SUBMITTED" ? pending.map.get(view.id) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profissionais"
        description={data ? `${formatNumber(data.total)} profissional(is) cadastrados` : "Prestadores de serviço da plataforma"}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/kyc">
                <BadgeCheck /> Fila de verificação
              </Link>
            </Button>
            {canEdit && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus /> Cadastrar profissional
              </Button>
            )}
          </>
        }
      />

      <SectionCard contentClassName="space-y-4">
        <FilterBar>
          <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Buscar por nome, telefone, serviço ou cidade…" />
          <FilterSelect
            label="Categoria"
            value={categoryId ?? "all"}
            onChange={(v) => set({ category: v === "all" ? "" : v })}
            options={categoryOptions}
          />
          <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
        </FilterBar>

        <DataTable
          columns={columns}
          data={query.data?.professionals}
          loading={query.isLoading}
          error={query.error?.message}
          onRetry={() => query.refetch()}
          getRowId={(r) => r.id}
          rowLabel={(r) => r.name ?? r.phone}
          onRowClick={(r) => setView(r)}
          empty={{
            icon: HardHat,
            title: hasFilters ? "Nenhum profissional encontrado" : "Ainda não há profissionais",
            description: hasFilters
              ? "Ajuste a busca, a categoria ou o status."
              : "Profissionais aparecem aqui quando ativam a conta profissional no app.",
          }}
          pagination={
            data
              ? {
                  page: data.page,
                  pageSize: data.pageSize,
                  total: data.total,
                  onPageChange: (p) => set({ page: String(p) }, { resetPage: false }),
                }
              : undefined
          }
          sorting={{ sortBy, sortDir, onChange: (by, dir) => set({ sortBy: by, sortDir: dir }) }}
        />
      </SectionCard>

      <UserDrawer
        userId={view?.id ?? null}
        onOpenChange={(o) => !o && setView(null)}
        title="Perfil do profissional"
        extra={
          view && (
            <div>
              <h3 className="mb-1.5 text-sm font-bold text-navy">Serviços</h3>
              <CategoryTags categories={view.categories} max={8} />
            </div>
          )
        }
        actions={(d) => (
          <>
            {viewReviewId && (
              <Button asChild variant="soft">
                <Link href={`/kyc/${viewReviewId}`}>
                  <BadgeCheck /> Analisar verificação
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button asChild variant="outline">
                <Link href={`/users/${d.user.id}`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            )}
            <DisabledHint hint={readOnlyReason}>
              <Button
                variant={d.user.isActive ? "destructive" : "outline"}
                disabled={!canEdit}
                onClick={() => setActiveTarget({ id: d.user.id, name: d.user.name, isActive: d.user.isActive })}
              >
                {d.user.isActive ? "Suspender" : "Reativar"}
              </Button>
            </DisabledHint>
          </>
        )}
      />
      <UserActiveDialog
        kind="professional"
        target={activeTarget}
        onOpenChange={(o) => !o && setActiveTarget(null)}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        icon={HardHat}
        title="Cadastrar profissional"
        description="O cadastro de profissionais é feito pelo próprio prestador no app TRAMPO: ele cria a conta com o celular (código por SMS) e ativa a “Conta profissional”. Depois envia a verificação, que você aprova na fila de Verificação."
        steps={[
          "A pessoa cria a conta no app TRAMPO com o número de celular.",
          "No Perfil, toca em \"Conta profissional\" e escolhe os serviços que oferece.",
          "Envia os documentos e a certidão de antecedentes para verificação.",
          "Você analisa e aprova em Verificação; o profissional passa a receber pedidos.",
        ]}
        inviteText={PRO_INVITE_TEXT}
      />
    </div>
  );
}
