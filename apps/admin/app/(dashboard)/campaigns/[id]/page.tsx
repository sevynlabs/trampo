"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Mail, Send, CheckCircle2, XCircle, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { formatNumber, formatDateTime } from "@/lib/format";

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  SCHEDULED: { label: "Agendada", variant: "warning" },
  SENDING: { label: "Enviando", variant: "warning" },
  SENT: { label: "Enviada", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const query = trpc.admin.campaigns.get.useQuery({ id });
  const c = query.data;

  const send = trpc.admin.campaigns.send.useMutation({
    onSuccess: () => {
      utils.admin.campaigns.get.invalidate({ id });
      utils.admin.campaigns.list.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar às campanhas
      </Link>

      {query.isLoading && <Skeleton className="h-64 w-full" />}
      {query.isError && (
        <p className="text-sm text-destructive">Campanha não encontrada.</p>
      )}

      {c && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
                <Badge variant={(STATUS[c.status] ?? STATUS.DRAFT).variant}>
                  {(STATUS[c.status] ?? STATUS.DRAFT).label}
                </Badge>
              </div>
              <p className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground">
                {c.channel === "PUSH" ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {c.channel === "PUSH" ? "Push" : "Email"} • {c.segmentDescription}
              </p>
            </div>

            {c.status === "DRAFT" && (
              <Button
                disabled={send.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Enviar "${c.name}" agora para o público selecionado? Esta ação não pode ser desfeita.`
                    )
                  ) {
                    send.mutate({ id });
                  }
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                {send.isPending ? "Enviando..." : "Enviar agora"}
              </Button>
            )}
          </div>

          {send.isError && (
            <p className="text-sm text-destructive">{send.error.message}</p>
          )}

          {c.status === "SENT" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Destinatários"
                value={formatNumber(c.recipientCount)}
                icon={Users}
              />
              <StatCard
                label="Enviados"
                value={formatNumber(c.sentCount)}
                icon={CheckCircle2}
              />
              <StatCard
                label="Falhas"
                value={formatNumber(c.failedCount)}
                icon={XCircle}
                highlight={c.failedCount > 0}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {c.channel === "PUSH" ? "Push" : "Email"} — prévia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {c.channel === "PUSH" ? "Título" : "Assunto"}
                </p>
                <p className="font-medium">{c.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {c.channel === "PUSH" ? "Mensagem" : "Corpo"}
                </p>
                {c.channel === "EMAIL" ? (
                  <div
                    className="prose prose-sm mt-1 max-w-none rounded-md border bg-muted/30 p-3 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: c.body }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{c.body}</p>
                )}
              </div>
              {c.sentAt && (
                <p className="text-xs text-muted-foreground">
                  Enviada em {formatDateTime(c.sentAt)}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
