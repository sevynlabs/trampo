"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, MessagesSquare } from "lucide-react";
import { ErrorState, LoadingState, StatusBadge, Tag, UserCell } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DISPUTE_STATUS, PAYMENT_STATUS, TASK_STATUS } from "@/constants/status";
import { cn } from "@/lib/utils";
import { formatBRL, formatDateTime } from "@/lib/format";
import { OPENED_BY_LABEL, useDispute, type DisputeDetail } from "../api";
import { ResolveDisputeForm } from "./resolve-form";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-navy">{children}</span>
    </div>
  );
}

function Timeline({ items }: { items: DisputeDetail["timeline"] }) {
  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute bottom-1 left-[7px] top-1 w-px bg-border" aria-hidden />
      {items.map((e, i) => {
        const last = i === items.length - 1;
        const Icon = last ? Circle : CheckCircle2;
        return (
          <li key={e.key} className="relative">
            <Icon
              className={cn(
                "absolute -left-6 top-0.5 h-4 w-4 bg-background",
                e.key.startsWith("dispute") ? "text-rose-500" : "text-emerald-500",
                e.key === "disputeResolved" && "text-emerald-600"
              )}
              aria-hidden
            />
            <div className="text-sm font-semibold text-navy">{e.label}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(e.at)}</div>
          </li>
        );
      })}
    </ol>
  );
}

const ROLE_LABEL = { CLIENT: "Cliente", TASKER: "Profissional", OTHER: "Outro" } as const;

function Chat({ messages }: { messages: DisputeDetail["messages"] }) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
        <MessagesSquare className="h-4 w-4" aria-hidden /> Nenhuma mensagem trocada nesta solicitação.
      </div>
    );
  }
  return (
    <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/30 p-3" role="log" aria-label="Mensagens do chat">
      {messages.map((m) => {
        const isClient = m.senderRole === "CLIENT";
        const isOther = m.senderRole === "OTHER";
        return (
          <div key={m.id} className={cn("flex", isClient ? "justify-start" : isOther ? "justify-center" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                isClient && "rounded-bl-md bg-card text-foreground",
                m.senderRole === "TASKER" && "rounded-br-md bg-navy text-white",
                isOther && "bg-amber-50 text-amber-900"
              )}
            >
              <div className={cn("mb-0.5 text-2xs font-semibold", m.senderRole === "TASKER" ? "text-white/70" : "text-muted-foreground")}>
                {m.senderName ?? "Usuário"} · {ROLE_LABEL[m.senderRole]}
              </div>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              <div className={cn("mt-1 text-right text-2xs", m.senderRole === "TASKER" ? "text-white/60" : "text-muted-foreground")}>
                {formatDateTime(m.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DisputeBody({ d }: { d: DisputeDetail }) {
  return (
    <div className="space-y-6">
      <Section title="Envolvidos">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card p-3">
            <div className="mb-2 text-2xs font-medium text-muted-foreground">Cliente</div>
            <UserCell name={d.client.name} avatarUrl={d.client.avatarUrl} publicCode={d.client.publicCode} size="sm" />
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-3">
            <div className="mb-2 text-2xs font-medium text-muted-foreground">Profissional</div>
            {d.tasker ? (
              <UserCell name={d.tasker.name} avatarUrl={d.tasker.avatarUrl} publicCode={d.tasker.publicCode} size="sm" />
            ) : (
              <span className="text-sm text-muted-foreground">Sem profissional atribuído</span>
            )}
          </div>
        </div>
      </Section>

      <Section title="Motivo">
        <div className="rounded-xl border-l-4 border-rose-400 bg-rose-50/60 p-4">
          <div className="mb-1 text-2xs font-semibold text-rose-700">{OPENED_BY_LABEL[d.openedBy]}</div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{d.reason}</p>
        </div>
      </Section>

      <Section
        title="Serviço"
        action={
          <Button asChild variant="outline" size="xs">
            <Link href={`/requests?id=${d.task.id}`}>
              <ExternalLink /> Ver solicitação
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy">{d.task.title}</span>
            <StatusBadge map={TASK_STATUS} status={d.task.status} />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {d.task.category.name} · {d.task.code}
          </div>
          {d.task.description && <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{d.task.description}</p>}
        </div>
      </Section>

      <Section title="Valores e pagamento">
        <div className="divide-y rounded-xl border border-border/70 bg-card px-3">
          <Row label="Valor em disputa">{formatBRL(d.amount)}</Row>
          <Row label="Total da solicitação">{formatBRL(d.task.totalValue)}</Row>
          {d.payment ? (
            <>
              <Row label="Status do pagamento">
                <StatusBadge map={PAYMENT_STATUS} status={d.payment.status} />
              </Row>
              <Row label="Taxa da plataforma">{formatBRL(d.payment.platformFee)}</Row>
              <Row label="Repasse ao profissional">{formatBRL(d.payment.taskerAmount)}</Row>
              <Row label="Pago em">{formatDateTime(d.payment.paidAt)}</Row>
              {d.payment.releasedAt && <Row label="Liberado em">{formatDateTime(d.payment.releasedAt)}</Row>}
              {d.payment.refundedAt && <Row label="Reembolsado em">{formatDateTime(d.payment.refundedAt)}</Row>}
            </>
          ) : (
            <Row label="Pagamento">Não registrado</Row>
          )}
        </div>
      </Section>

      <Section title="Linha do tempo">
        <Timeline items={d.timeline} />
      </Section>

      <Section title={`Chat da solicitação${d.messages.length ? ` · últimas ${d.messages.length}` : ""}`}>
        <Chat messages={d.messages} />
      </Section>

      {d.status !== "OPEN" ? (
        <Section title="Resolução">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              <StatusBadge map={DISPUTE_STATUS} status={d.status} />
              {d.resolvedAt && <span>em {formatDateTime(d.resolvedAt)}</span>}
              {d.resolverName && <span>por {d.resolverName}</span>}
            </div>
            {d.resolution ? (
              <p className="mt-2 whitespace-pre-wrap">{d.resolution}</p>
            ) : (
              <p className="mt-2 italic">Sem observações registradas.</p>
            )}
          </div>
        </Section>
      ) : (
        <ResolveDisputeForm key={d.id} dispute={d} />
      )}
    </div>
  );
}

/** Detail drawer of a dispute; loads `admin.disputes.get` by id. */
export function DisputeSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const q = useDispute(id);
  const d = q.data;
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{d ? `Disputa ${d.code}` : "Disputa"}</SheetTitle>
            {d && <StatusBadge map={DISPUTE_STATUS} status={d.status} />}
            {d && <Tag tone="navy">{d.task.category.name}</Tag>}
          </div>
          <SheetDescription>
            {d ? `Aberta em ${formatDateTime(d.createdAt)} · ${formatBRL(d.amount)}` : "Carregando detalhes…"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {q.isLoading ? (
            <LoadingState rows={8} />
          ) : q.error ? (
            <ErrorState description={q.error.message} onRetry={() => q.refetch()} />
          ) : d ? (
            <DisputeBody d={d} />
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
