"use client";

import { useState } from "react";
import { CheckCircle2, Send, Users, XCircle } from "lucide-react";
import { ConfirmDialog, ErrorState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_STATUS } from "@/constants/status";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAdminRole } from "@/hooks/use-admin-role";
import { useCampaign, useSendCampaign } from "../api";
import { ChannelLabel } from "./campaign-columns";

const BREADCRUMB = [{ label: "Campanhas", href: "/campaigns" }];

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-navy">{children}</dd>
    </div>
  );
}

export function CampaignDetail({ id }: { id: string }) {
  const q = useCampaign(id);
  const [confirm, setConfirm] = useState(false);
  const send = useSendCampaign(id, () => setConfirm(false));
  const { canEdit } = useAdminRole();
  const c = q.data;

  if (q.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campanha" breadcrumb={BREADCRUMB} />
        <LoadingState rows={6} />
      </div>
    );
  }
  if (q.error || !c) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campanha" breadcrumb={BREADCRUMB} />
        <SectionCard>
          <ErrorState title="Campanha não encontrada" description={q.error?.message} onRetry={() => q.refetch()} />
        </SectionCard>
      </div>
    );
  }

  const canSend = canEdit && (c.status === "DRAFT" || c.status === "FAILED");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[...BREADCRUMB, { label: c.name }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {c.name} <StatusBadge map={CAMPAIGN_STATUS} status={c.status} />
          </span>
        }
        description={c.segmentDescription}
        actions={
          canSend && (
            <Button onClick={() => setConfirm(true)} disabled={send.isPending}>
              <Send /> {send.isPending ? "Enviando…" : "Enviar agora"}
            </Button>
          )
        }
      />

      {c.recipientCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} tone="navy" label="Destinatários" value={formatNumber(c.recipientCount)} />
          <StatCard icon={CheckCircle2} tone="success" label="Entregues" value={formatNumber(c.sentCount)} />
          <StatCard icon={XCircle} tone={c.failedCount > 0 ? "danger" : "sky"} label="Falhas" value={formatNumber(c.failedCount)} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard title={`Prévia · ${c.channel === "PUSH" ? "notificação push" : "e-mail"}`}>
          <div className="space-y-4">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c.channel === "PUSH" ? "Título" : "Assunto"}
              </p>
              <p className="mt-0.5 font-semibold text-navy">{c.title}</p>
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c.channel === "PUSH" ? "Mensagem" : "Corpo"}
              </p>
              {c.channel === "EMAIL" ? (
                <div
                  className="prose prose-sm mt-1 max-w-none rounded-xl border border-border/70 bg-muted/30 p-4"
                  // Body is authored by admins in the panel (trusted source).
                  dangerouslySetInnerHTML={{ __html: c.body }}
                />
              ) : (
                <div className="mt-1 max-w-sm rounded-2xl bg-navy p-3 text-sm text-white shadow-card">
                  <div className="font-semibold">{c.title}</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-white/80">{c.body}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1">{"{{name}}"}</code> é substituído pelo nome de cada usuário no envio.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Detalhes">
          <dl className="grid gap-4">
            <Info label="Canal">
              <ChannelLabel channel={c.channel} />
            </Info>
            <Info label="Público">{c.segmentDescription}</Info>
            <Info label="Criada em">{formatDateTime(c.createdAt)}</Info>
            <Info label="Enviada em">{formatDateTime(c.sentAt)}</Info>
          </dl>
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Enviar campanha agora?"
        description={
          <>
            “{c.name}” será enviada por {c.channel === "PUSH" ? "push" : "e-mail"} para o público: {c.segmentDescription}. Esta ação
            não pode ser desfeita.
          </>
        }
        confirmLabel="Enviar agora"
        loading={send.isPending}
        onConfirm={() => send.mutate({ id })}
      />
    </div>
  );
}
