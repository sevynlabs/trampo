"use client";

import Link from "next/link";
import { ExternalLink, EyeOff, RotateCcw } from "lucide-react";
import { DisabledHint, StarRow, StatusBadge, Tag, UserCell } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import { DIRECTION_LABEL, reviewParties, type ReviewRow } from "../api";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Detail drawer of one review (full comment, tags, parties, moderation state). */
export function ReviewSheet({
  review,
  onOpenChange,
  onHide,
  onUnhide,
  readOnlyReason,
}: {
  review: ReviewRow | null;
  onOpenChange: (open: boolean) => void;
  onHide: (r: ReviewRow) => void;
  onUnhide: (r: ReviewRow) => void;
  readOnlyReason?: string;
}) {
  const r = review;
  const parties = r ? reviewParties(r) : null;
  return (
    <Sheet open={!!r} onOpenChange={onOpenChange}>
      <SheetContent>
        {r && parties && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>Avaliação de {r.rating} estrela{r.rating > 1 ? "s" : ""}</SheetTitle>
                {r.hiddenAt ? <StatusBadge tone="neutral" label="Oculta" /> : <StatusBadge tone="success" label="Visível" />}
              </div>
              <SheetDescription>
                {DIRECTION_LABEL[r.direction]} · {formatDateTime(r.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
                <span className="text-3xl font-extrabold tabular-nums text-navy">{r.rating},0</span>
                <StarRow value={r.rating} className="[&_svg]:h-5 [&_svg]:w-5" />
              </div>

              <Section title="Comentário">
                {r.comment ? (
                  <blockquote className="whitespace-pre-wrap rounded-xl border-l-4 border-brand bg-brand-soft/40 p-4 text-sm text-foreground">
                    “{r.comment}”
                  </blockquote>
                ) : (
                  <p className="text-sm italic text-muted-foreground">O avaliador não deixou comentário.</p>
                )}
              </Section>

              {r.tags.length > 0 && (
                <Section title="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <Tag key={t} tone="navy">
                        {t}
                      </Tag>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Envolvidos">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 p-3">
                    <div className="mb-2 text-2xs font-medium text-muted-foreground">Cliente</div>
                    <UserCell name={parties.client.name} avatarUrl={parties.client.avatarUrl} publicCode={parties.client.publicCode} size="sm" />
                  </div>
                  <div className="rounded-xl border border-border/70 p-3">
                    <div className="mb-2 text-2xs font-medium text-muted-foreground">Profissional</div>
                    <UserCell name={parties.professional.name} avatarUrl={parties.professional.avatarUrl} publicCode={parties.professional.publicCode} size="sm" />
                  </div>
                </div>
              </Section>

              <Section title="Serviço">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-navy">{r.task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.task.categoryName} · {r.task.code}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="xs">
                    <Link href={`/requests?id=${r.task.id}`}>
                      <ExternalLink /> Ver solicitação
                    </Link>
                  </Button>
                </div>
              </Section>

              {r.hiddenAt && (
                <Section title="Moderação">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-semibold">Ocultada em {formatDateTime(r.hiddenAt)}</div>
                    {r.hiddenReason && <p className="mt-1">Motivo: {r.hiddenReason}</p>}
                  </div>
                </Section>
              )}

              <p className="text-xs text-muted-foreground">
                Ocultar remove a avaliação do app e recalcula a nota média do profissional. A ação pode ser desfeita.
              </p>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <DisabledHint hint={readOnlyReason}>
                {r.hiddenAt ? (
                  <Button variant="navy" disabled={!!readOnlyReason} onClick={() => onUnhide(r)}>
                    <RotateCcw /> Reexibir
                  </Button>
                ) : (
                  <Button variant="destructive" disabled={!!readOnlyReason} onClick={() => onHide(r)}>
                    <EyeOff /> Ocultar
                  </Button>
                )}
              </DisabledHint>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
