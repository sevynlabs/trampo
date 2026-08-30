"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusBadge } from "@/components/status-badges";
import { formatBRL, formatDateTime } from "@/lib/format";

const TIMELINE_STEPS: { key: string; label: string }[] = [
  { key: "createdAt", label: "Criado" },
  { key: "paidAt", label: "Pago pelo cliente" },
  { key: "heldAt", label: "Em custódia (escrow)" },
  { key: "releasedAt", label: "Liberado ao profissional" },
  { key: "refundedAt", label: "Reembolsado" },
];

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = trpc.admin.finance.getPayment.useQuery({ id });
  const p = query.data;

  return (
    <div className="space-y-6">
      <Link
        href="/finance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro
      </Link>

      {query.isLoading && <Skeleton className="h-64 w-full" />}
      {query.isError && (
        <p className="text-sm text-destructive">Pagamento não encontrado.</p>
      )}

      {p && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {p.task?.title ?? "Pagamento"}
              </h1>
              <p className="text-muted-foreground">
                Pagador: {p.payer?.name ?? "—"}
                {p.payer?.phone ? ` • ${p.payer.phone}` : ""}
              </p>
            </div>
            <PaymentStatusBadge status={p.status} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Valores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Total cobrado" value={formatBRL(p.amount)} strong />
                <Row label="Comissão da plataforma" value={formatBRL(p.platformFee)} />
                <Row label="Repasse ao profissional" value={formatBRL(p.taskerAmount)} />
                <div className="border-t pt-2">
                  <Row label="Asaas payment ID" value={p.asaasPaymentId ?? "—"} mono />
                  <Row label="Asaas transfer ID" value={p.asaasTransferId ?? "—"} mono />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline de custódia</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {TIMELINE_STEPS.map((step) => {
                    const ts = (p.timeline as Record<string, string | null>)[step.key];
                    const done = !!ts;
                    return (
                      <li key={step.key} className="flex items-start gap-3">
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            done ? "bg-primary" : "bg-muted"
                          }`}
                        />
                        <div className="flex-1">
                          <p
                            className={
                              done ? "text-sm font-medium" : "text-sm text-muted-foreground"
                            }
                          >
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {done ? formatDateTime(ts) : "—"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`${strong ? "text-base font-bold" : ""} ${
          mono ? "font-mono text-xs" : "tabular-nums"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
