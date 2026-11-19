"use client";

import { PublicId } from "@/components/ds/people";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
import { ErrorState, LoadingState, RatingStars, StatusBadge, UserAvatar } from "@/components/ds";
import { TASK_STATUS } from "@/constants/status";
import { formatBRL, formatDate } from "@/lib/format";
import { useUser, type UserDetail } from "../api";
import { ActiveBadge, KycBadge, RoleTag } from "./user-badges";

/** Label/value line used in detail cards and drawers. */
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="text-base font-extrabold tabular-nums text-navy">{value}</div>
      <div className="text-2xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function SummaryBody({ data, extra }: { data: UserDetail; extra?: React.ReactNode }) {
  const { user, taskerProfile: pro } = data;
  const recent = [...data.tasksAsClient, ...data.tasksAsTasker]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <UserAvatar name={user.name} src={user.avatarUrl} size="xl" />
        <div className="min-w-0 space-y-1.5">
          <div className="truncate text-lg font-bold text-navy">{user.name || "Sem nome"}</div>
          <PublicId code={user.publicCode} />
          <div className="flex flex-wrap items-center gap-1.5">
            <RoleTag role={user.role} />
            <ActiveBadge active={user.isActive} />
            <KycBadge status={pro?.kycStatus} />
          </div>
        </div>
      </div>

      {extra}

      {pro && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Avaliação" value={<RatingStars value={pro.rating} />} />
          <MiniStat label="Trampos concluídos" value={pro.totalTasks} />
          <MiniStat label="Ganhos totais" value={formatBRL(pro.balance.totalEarnings)} />
        </div>
      )}

      <div>
        <h3 className="mb-1 text-sm font-bold text-navy">Contato</h3>
        <InfoRow label="Telefone" value={user.phone} />
        <InfoRow label="E-mail" value={user.email || "—"} />
        <InfoRow label="Cadastro" value={formatDate(user.createdAt)} />
        {pro && <InfoRow label="Saldo disponível" value={formatBRL(pro.balance.available)} />}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold text-navy">Solicitações recentes</h3>
        {recent.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
        ) : (
          recent.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-navy">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(t.createdAt)} · {formatBRL(t.value)}
                </div>
              </div>
              <StatusBadge map={TASK_STATUS} status={t.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Drawer with a user's summary (getUser). `actions` renders the footer
 * buttons with the loaded data (block, edit, approve…).
 */
export function UserDrawer({
  userId,
  onOpenChange,
  title = "Resumo do usuário",
  extra,
  actions,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
  title?: string;
  extra?: React.ReactNode;
  actions?: (data: UserDetail) => React.ReactNode;
}) {
  const query = useUser(userId);
  return (
    <Sheet open={!!userId} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Dados principais e atividade recente.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {query.isLoading ? (
            <LoadingState rows={6} />
          ) : query.error || !query.data ? (
            <ErrorState description={query.error?.message ?? "Usuário não encontrado."} onRetry={() => query.refetch()} />
          ) : (
            <SummaryBody data={query.data} extra={extra} />
          )}
        </SheetBody>
        {query.data && (
          <SheetFooter className="flex-wrap">
            {actions?.(query.data)}
            <Button asChild variant="navy">
              <Link href={`/users/${query.data.user.id}`}>
                <ExternalLink /> Ver perfil completo
              </Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
