"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, HardHat, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, FilterBar, FilterSelect, PageHeader, SearchInput, SectionCard } from "@/components/ds";
import { useUrlState } from "@/hooks/use-url-state";
import { formatNumber } from "@/lib/format";
import { UserDrawer } from "@/features/users/components/user-summary";
import { UserActiveDialog, type ActiveTarget } from "@/features/users/components/user-active-dialog";
import { InviteDialog } from "@/features/users/components/invite-dialog";
import {
  usePendingKycProfileIds,
  useProfessionalsList,
  useServiceCategories,
  type ProfessionalRow,
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
  const [s, set] = useUrlState({ q: "", page: "1", status: "all", category: "" });
  const page = Math.max(1, Number(s.page) || 1);
  const status = (STATUS_OPTIONS.some((o) => o.value === s.status) ? s.status : "all") as ProfessionalStatusFilter;

  const categories = useServiceCategories();
  const category = categories.data?.find((c) => c.id === s.category);
  const q = s.q.trim();

  // The API has no category filter: its search also matches category names, so the
  // category goes as the search term. With both a text search and a category, the
  // text goes to the API and the category is applied to the returned page.
  const search = q || category?.name || undefined;
  const pageCategoryFilter = !!q && !!category;

  const query = useProfessionalsList({ page, pageSize: PAGE_SIZE, search, status });
  const pending = usePendingKycProfileIds();

  const rows = useMemo(() => {
    const list = query.data?.professionals;
    if (!list || !pageCategoryFilter || !category) return list;
    return list.filter((p) => p.categories.includes(category.name));
  }, [query.data, pageCategoryFilter, category]);

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
      }),
    [router, pending.map]
  );

  const categoryOptions = [
    { value: "all", label: "Todas" },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${formatNumber(c.professionalsCount)})` })),
  ];

  const data = query.data;
  const hasFilters = !!q || status !== "all" || !!category;
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
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Cadastrar profissional
            </Button>
          </>
        }
      />

      <SectionCard contentClassName="space-y-4">
        <FilterBar>
          <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Buscar por nome, telefone ou serviço…" />
          <FilterSelect
            label="Categoria"
            value={category ? category.id : "all"}
            onChange={(v) => set({ category: v === "all" ? "" : v })}
            options={categoryOptions}
          />
          <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
        </FilterBar>

        {pageCategoryFilter && (
          <p className="text-xs text-muted-foreground">
            Busca por texto combinada com categoria: a categoria <b>{category?.name}</b> é aplicada aos resultados desta página.
          </p>
        )}

        <DataTable
          columns={columns}
          data={rows}
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
            <Button asChild variant="outline">
              <Link href={`/users/${d.user.id}`}>
                <Pencil /> Editar
              </Link>
            </Button>
            <Button
              variant={d.user.isActive ? "destructive" : "outline"}
              onClick={() => setActiveTarget({ id: d.user.id, name: d.user.name, isActive: d.user.isActive })}
            >
              {d.user.isActive ? "Suspender" : "Reativar"}
            </Button>
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
