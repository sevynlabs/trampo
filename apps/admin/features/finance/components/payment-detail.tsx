"use client";

import Link from "next/link";
import { ExternalLink, Phone } from "lucide-react";
import { StatusBadge, UserAvatar } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { PAYMENT_STATUS, TASK_STATUS } from "@/constants/status";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentDetail } from "../api";

const ESCROW_STEPS: { key: keyof PaymentDetail["timeline"]; label: string; danger?: boolean }[] = [
  { key: "createdAt", label: "Cobrança criada" },
  { key: "paidAt", label: "Pago pelo cliente" },
  { key: "heldAt", label: "Em custódia (escrow)" },
  { key: "releasedAt", label: "Repassado ao profissional" },
  { key: "refundedAt", label: "Reembolsado ao cliente", danger: true },
];

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 text-sm", strong && "font-bold text-navy")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className={cn("truncate", mono ? "font-mono text-xs" : "tabular-nums")}>{value}</span>
    </div>
  );
}

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-navy">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Payment detail body — shared by the drawer and /finance/[id]. */
export function PaymentDetailContent({ p, columns = 1 }: { p: PaymentDetail; columns?: 1 | 2 }) {
  // Refunded payments skip the release step; released ones skip refund.
  const steps = ESCROW_STEPS.filter((s) => !(s.key === "refundedAt" && !p.timeline.refundedAt && p.timeline.releasedAt) && !(s.key === "releasedAt" && p.timeline.refundedAt));
  return (
    <div className={cn("grid gap-4", columns === 2 && "lg:grid-cols-2")}>
      <div className="space-y-4">
        <Block title="Valores">
          <div className="space-y-2">
            <Row label="Total cobrado" value={formatBRL(p.amount)} strong />
            <Row label="Taxa da plataforma" value={formatBRL(p.platformFee)} />
            <Row label="Repasse ao profissional" value={formatBRL(p.taskerAmount)} />
          </div>
          <div className="space-y-2 border-t pt-3">
            <Row label="Asaas payment ID" value={p.asaasPaymentId ?? "—"} mono />
            <Row label="Asaas transfer ID" value={p.asaasTransferId ?? "—"} mono />
          </div>
        </Block>

        <Block title="Pagador">
          {p.payer ? (
            <Link
              href={`/users/${p.payer.id}`}
              className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserAvatar name={p.payer.name} size="md" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-navy hover:underline">{p.payer.name || "Sem nome"}</div>
                {p.payer.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" aria-hidden /> {p.payer.phone}
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </Block>

        {p.task && (
          <Block
            title="Solicitação"
            action={
              <Button asChild variant="ghost" size="xs">
                <Link href={`/requests?id=${p.task.id}`}>
                  Abrir <ExternalLink />
                </Link>
              </Button>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-navy">{p.task.title}</span>
              <StatusBadge map={TASK_STATUS} status={p.task.status} />
            </div>
          </Block>
        )}
      </div>

      <Block title="Linha do tempo da custódia">
        <ol className="relative space-y-4 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border">
          {steps.map((s) => {
            const at = p.timeline[s.key];
            return (
              <li key={s.key} className="relative">
                <span
                  className={cn(
                    "absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card",
                    at ? (s.danger ? "bg-rose-500" : "bg-brand") : "bg-muted ring-1 ring-border"
                  )}
                  aria-hidden
                />
                <div className={cn("text-sm", at ? "font-semibold text-navy" : "text-muted-foreground")}>{s.label}</div>
                <div className="text-xs text-muted-foreground">{at ? formatDateTime(at) : "Pendente"}</div>
              </li>
            );
          })}
        </ol>
      </Block>
    </div>
  );
}

export function PaymentStatusHeader({ p }: { p: PaymentDetail }) {
  return <StatusBadge map={PAYMENT_STATUS} status={p.status} />;
}
