"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarClock,
  CreditCard,
  ExternalLink,
  MapPin,
  Phone,
  Scale,
  Star,
  Zap,
} from "lucide-react";
import { ConfirmDialog, ErrorState, LoadingState, StarRow, StatusBadge, Tag, UserAvatar } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DISPUTE_STATUS, PAYMENT_STATUS, TASK_STATUS } from "@/constants/status";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCancelRequest, useRequest, type RequestDetail } from "../api";

const CANCELLABLE = new Set(["OPEN", "ACCEPTED"]);

function Section({ title, icon: Icon, children, action }: { title: string; icon?: typeof MapPin; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function PersonCard({
  role,
  person,
}: {
  role: string;
  person: { id: string; name: string | null; avatarUrl: string | null; phone?: string | null } | null;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{role}</div>
      {person ? (
        <Link
          href={`/users/${person.id}`}
          className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar name={person.name} src={person.avatarUrl} size="md" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-navy hover:underline">{person.name || "Sem nome"}</div>
            {person.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" aria-hidden /> {person.phone}
              </div>
            )}
          </div>
        </Link>
      ) : (
        <div className="text-sm text-muted-foreground">Ainda sem profissional</div>
      )}
    </div>
  );
}

function MoneyRow({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between text-sm", strong && "border-t pt-2 font-bold text-navy", muted && "text-muted-foreground")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{formatBRL(value)}</span>
    </div>
  );
}

function Timeline({ items }: { items: RequestDetail["timeline"] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Sem eventos.</p>;
  return (
    <ol className="relative space-y-4 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border">
      {items.map((e, i) => {
        const danger = e.key === "cancelledAt" || e.key === "disputedAt";
        const last = i === items.length - 1;
        return (
          <li key={e.key} className="relative">
            <span
              className={cn(
                "absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card",
                danger ? "bg-rose-500" : last ? "bg-brand" : "bg-navy/40"
              )}
              aria-hidden
            />
            <div className={cn("text-sm font-semibold", danger ? "text-rose-700" : "text-navy")}>{e.label}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(e.at)}</div>
          </li>
        );
      })}
    </ol>
  );
}

function DetailBody({ t, onCancel }: { t: RequestDetail; onCancel: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <PersonCard role="Cliente" person={t.client} />
        <PersonCard role="Profissional" person={t.tasker} />
      </div>

      {t.description && (
        <Section title="Descrição">
          <p className="whitespace-pre-line text-sm text-foreground/90">{t.description}</p>
        </Section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Endereço" icon={MapPin}>
          <p className="text-sm">{t.address}</p>
        </Section>
        <Section title="Agendamento" icon={CalendarClock}>
          <p className="text-sm">{t.scheduledAt ? formatDateTime(t.scheduledAt) : "Sem data definida"}</p>
          {t.isUrgent && (
            <Tag tone="brand" className="gap-1">
              <Zap className="h-3 w-3" aria-hidden /> Urgente
            </Tag>
          )}
        </Section>
      </div>

      <Section title="Valores">
        <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
          <MoneyRow label="Valor base" value={t.price.baseValue} />
          {t.price.urgencyFee > 0 && <MoneyRow label="Taxa de urgência" value={t.price.urgencyFee} />}
          <MoneyRow label="Taxa de serviço" value={t.price.serviceFee} />
          <MoneyRow label="Total pago pelo cliente" value={t.price.totalValue} strong />
          <MoneyRow label="Repasse ao profissional" value={t.price.taskerValue} muted />
          <MoneyRow label="Receita da plataforma" value={t.price.platformRevenue} muted />
        </div>
      </Section>

      <Section
        title="Pagamento"
        icon={CreditCard}
        action={
          t.payment && (
            <Button asChild variant="ghost" size="xs">
              <Link href={`/finance/${t.payment.id}`}>
                Ver pagamento <ExternalLink />
              </Link>
            </Button>
          )
        }
      >
        {t.payment ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge map={PAYMENT_STATUS} status={t.payment.status} />
              <span className="font-semibold tabular-nums text-navy">{formatBRL(t.payment.amount)}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t.payment.paidAt ? `Pago em ${formatDateTime(t.payment.paidAt)}` : `Criado em ${formatDateTime(t.payment.createdAt)}`}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum pagamento gerado.</p>
        )}
      </Section>

      {t.dispute && (
        <Section
          title="Disputa"
          icon={Scale}
          action={
            <Button asChild variant="soft" size="xs">
              <Link href={`/disputes?id=${t.dispute.id}`}>
                Abrir disputa <ExternalLink />
              </Link>
            </Button>
          }
        >
          <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge map={DISPUTE_STATUS} status={t.dispute.status} />
              <span className="text-xs text-muted-foreground">
                Aberta por{" "}
                {t.dispute.openedBy === "CLIENT" ? "cliente" : t.dispute.openedBy === "TASKER" ? "profissional" : "—"} em{" "}
                {formatDateTime(t.dispute.createdAt)}
              </span>
            </div>
            <p>{t.dispute.reason}</p>
            {t.dispute.resolution && <p className="text-muted-foreground">Resolução: {t.dispute.resolution}</p>}
          </div>
        </Section>
      )}

      {t.cancellation && (
        <Section title="Cancelamento" icon={Ban}>
          <div className="space-y-1 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
            <p>{t.cancellation.reason || "Sem motivo informado"}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(t.cancellation.createdAt)}
              {t.cancellation.wasPenalized && ` · multa de ${formatBRL(t.cancellation.penaltyAmount)}`}
            </p>
          </div>
        </Section>
      )}

      <Section title="Linha do tempo">
        <Timeline items={t.timeline} />
      </Section>

      <Section title="Avaliações" icon={Star}>
        {t.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
        ) : (
          <ul className="space-y-3">
            {t.reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={r.reviewer.name} src={r.reviewer.avatarUrl} size="xs" />
                    <span className="truncate text-sm font-semibold text-navy">{r.reviewer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.direction === "CLIENT_TO_PRO" ? "avaliou o profissional" : "avaliou o cliente"}
                    </span>
                  </div>
                  <StarRow value={r.rating} />
                </div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {r.tags.map((tag) => (
                    <Tag key={tag} tone="neutral">
                      {tag}
                    </Tag>
                  ))}
                  {r.hiddenAt && <StatusBadge tone="neutral" label="Oculta" />}
                  <span className="text-2xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {CANCELLABLE.has(t.status) && (
        <div className="rounded-xl border border-rose-200 p-4">
          <div className="text-sm font-bold text-navy">Cancelar solicitação</div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Disponível enquanto a solicitação está aguardando ou aceita e sem pagamento retido.
          </p>
          <Button variant="destructive" size="sm" className="mt-3" onClick={onCancel}>
            <Ban /> Cancelar solicitação
          </Button>
        </div>
      )}
    </div>
  );
}

/** Drawer with the full detail of a solicitação + admin cancellation. */
export function RequestDetailSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  // Keep the last id while the drawer animates closed, so content doesn't flash.
  const lastId = useRef(id);
  if (id) lastId.current = id;
  const shownId = id ?? lastId.current;
  const q = useRequest(shownId);
  const t = q.data;
  const [confirm, setConfirm] = useState(false);
  const cancel = useCancelRequest({ onSuccess: () => setConfirm(false) });

  return (
    <>
      <Sheet open={!!id} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl" aria-describedby="request-detail-desc">
          <SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="font-mono">{t?.code ?? "Solicitação"}</SheetTitle>
              {t && <StatusBadge map={TASK_STATUS} status={t.status} />}
            </div>
            <SheetDescription id="request-detail-desc">
              {t ? (
                <>
                  <span className="font-semibold text-foreground">{t.title}</span> · {t.category.name} · criada em{" "}
                  {formatDateTime(t.createdAt)}
                </>
              ) : (
                "Carregando detalhes…"
              )}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {q.isLoading ? (
              <LoadingState rows={8} />
            ) : q.error ? (
              <ErrorState description={q.error.message} onRetry={() => q.refetch()} />
            ) : t ? (
              <DetailBody t={t} onCancel={() => setConfirm(true)} />
            ) : null}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Cancelar ${t?.code ?? "solicitação"}?`}
        description="A solicitação será marcada como cancelada e cliente e profissional deixam de vê-la como ativa. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar solicitação"
        tone="danger"
        requireReason
        reasonLabel="Motivo do cancelamento"
        reasonPlaceholder="Ex.: solicitação duplicada a pedido do cliente"
        loading={cancel.isPending}
        onConfirm={(reason) => t && reason && cancel.mutate({ id: t.id, reason })}
      />
    </>
  );
}
