"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FlaskConical, Megaphone, PencilLine, Plus, Send } from "lucide-react";
import { DataTable, FilterBar, FilterSelect, InfoCard, PageHeader, SearchInput, SectionCard, StatCard } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { useUrlState } from "@/hooks/use-url-state";
import { useAdminRole } from "@/hooks/use-admin-role";
import { CAMPAIGN_STATUS } from "@/constants/status";
import { formatNumber } from "@/lib/format";
import { useCampaigns, useEmailStatus } from "../api";
import { buildCampaignColumns } from "./campaign-columns";
import { CampaignsNav } from "./campaigns-nav";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  ...Object.entries(CAMPAIGN_STATUS).map(([value, d]) => ({ value, label: d.label })),
];
const CHANNEL_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "PUSH", label: "Push" },
  { value: "EMAIL", label: "E-mail" },
];

export function CampaignsView() {
  const router = useRouter();
  const [s, set] = useUrlState({ q: "", status: "all", channel: "all" });
  const list = useCampaigns();
  const emailStatus = useEmailStatus();
  const { canEdit } = useAdminRole();

  const columns = useMemo(() => buildCampaignColumns({ onOpen: (c) => router.push(`/campaigns/${c.id}`) }), [router]);

  const rows = useMemo(() => {
    const q = s.q.trim().toLowerCase();
    return list.data?.filter(
      (c) =>
        (s.status === "all" || c.status === s.status) &&
        (s.channel === "all" || c.channel === s.channel) &&
        (!q || c.name.toLowerCase().includes(q))
    );
  }, [list.data, s.q, s.status, s.channel]);

  const all = list.data;
  const count = (st: string) => (all ? formatNumber(all.filter((c) => c.status === st).length) : undefined);
  const delivered = all ? formatNumber(all.reduce((sum, c) => sum + c.sentCount, 0)) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Notificações push e e-mail marketing para segmentos de usuários."
        actions={
          <>
            <CampaignsNav />
            {canEdit && (
              <Button asChild>
                <Link href="/campaigns/new">
                  <Plus /> Nova campanha
                </Link>
              </Button>
            )}
          </>
        }
      />

      {emailStatus.data?.mode === "dev" && (
        <InfoCard icon={FlaskConical} tone="warning" title="E-mail em modo de desenvolvimento">
          As mensagens de e-mail são apenas registradas no log da API, não enviadas. Configure <code>RESEND_API_KEY</code> para o
          envio real. Push funciona normalmente via Expo.
        </InfoCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Megaphone} tone="brand" label="Campanhas (últimas 100)" value={all ? formatNumber(all.length) : undefined} />
        <StatCard icon={PencilLine} tone="navy" label="Rascunhos" value={count("DRAFT")} />
        <StatCard icon={CheckCircle2} tone="success" label="Encerradas (enviadas)" value={count("SENT")} />
        <StatCard icon={Send} tone="sky" label="Mensagens entregues" value={delivered} />
      </div>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Buscar campanha pelo nome" />
            <FilterSelect label="Status" value={s.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
            <FilterSelect label="Canal" value={s.channel} onChange={(v) => set({ channel: v })} options={CHANNEL_OPTIONS} />
          </FilterBar>
          <DataTable
            columns={columns}
            data={rows}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(c) => c.id}
            onRowClick={(c) => router.push(`/campaigns/${c.id}`)}
            rowLabel={(c) => `Campanha ${c.name}`}
            empty={{
              icon: Megaphone,
              title: all?.length ? "Nenhuma campanha com esses filtros" : "Nenhuma campanha ainda",
              description: all?.length ? "Ajuste a busca ou os filtros." : "Crie a primeira campanha para falar com seus usuários.",
              action: all?.length || !canEdit ? undefined : (
                <Button asChild size="sm">
                  <Link href="/campaigns/new">
                    <Plus /> Nova campanha
                  </Link>
                </Button>
              ),
            }}
            clientPageSize={20}
          />
        </div>
      </SectionCard>
    </div>
  );
}
