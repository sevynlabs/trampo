"use client";

import { PublicId } from "@/components/ds/people";

import { useState } from "react";
import Link from "next/link";
import { Ban, BadgeCheck, Banknote, CalendarClock, Pencil, ShieldCheck, Star, UserX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DisabledHint,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StarRow,
  StatCard,
  StatusBadge,
  UserAvatar,
} from "@/components/ds";
import { useAdminRole } from "@/hooks/use-admin-role";
import { TASK_STATUS } from "@/constants/status";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { useUser, type UserDetail } from "../api";
import { ActiveBadge, IdentityBadge, KycBadge, RoleTag } from "./user-badges";
import { InfoRow, VerificationLinks } from "./user-summary";
import { RoleDialog, type RoleTarget } from "./role-dialog";
import { UserActiveDialog, type ActiveTarget } from "./user-active-dialog";

type TaskItem = UserDetail["tasksAsClient"][number];

function TaskList({ title, tasks, empty }: { title: string; tasks: TaskItem[]; empty: string }) {
  return (
    <SectionCard title={title} description="Últimas 5" contentClassName="pt-3">
      {tasks.length === 0 ? (
        <EmptyState icon={CalendarClock} title={empty} className="py-8" />
      ) : (
        <ul>
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">{t.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge map={TASK_STATUS} status={t.status} />
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{formatBRL(t.value)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Full user page (/users/[id]): profile, professional data, tasks and reviews. */
export function UserDetailView({ id }: { id: string }) {
  const query = useUser(id);
  const { canEdit, readOnlyReason } = useAdminRole();
  const [roleTarget, setRoleTarget] = useState<RoleTarget | null>(null);
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const data = query.data;

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Usuário" breadcrumb={[{ label: "Usuários", href: "/users" }, { label: "Carregando…" }]} />
        <LoadingState rows={6} />
      </div>
    );
  }

  if (query.error || !data) {
    const notFound = query.error?.data?.code === "NOT_FOUND";
    return (
      <div className="space-y-6">
        <PageHeader title="Usuário" breadcrumb={[{ label: "Usuários", href: "/users" }, { label: "Detalhe" }]} />
        <SectionCard>
          {notFound ? (
            <EmptyState
              icon={UserX}
              title="Usuário não encontrado"
              description="Ele pode ter sido removido ou o link está incorreto."
              action={
                <Button asChild variant="outline">
                  <Link href="/users">Voltar para usuários</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState description={query.error?.message} onRetry={() => query.refetch()} />
          )}
        </SectionCard>
      </div>
    );
  }

  const { user, taskerProfile: pro } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Usuários", href: "/users" }, { label: user.name || "Sem nome" }]}
        title={
          <span className="flex items-center gap-3">
            <UserAvatar name={user.name} src={user.avatarUrl} size="lg" />
            <span className="truncate">{user.name || "Sem nome"}</span>
            <PublicId code={user.publicCode} className="text-sm" />
          </span>
        }
        description={
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <RoleTag role={user.role} />
            <ActiveBadge active={user.isActive} />
            <IdentityBadge status={data.identity.status} />
            <KycBadge status={pro?.kycStatus} />
            <span className="text-xs text-muted-foreground">· cadastro em {formatDate(user.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {data.identity.status === "SUBMITTED" && pro?.kycStatus !== "SUBMITTED" && (
              <Button asChild variant="soft">
                <Link href={`/kyc/identidade/${user.id}`}>
                  <BadgeCheck /> Analisar identidade
                </Link>
              </Button>
            )}
            {pro?.kycStatus === "SUBMITTED" && (
              <Button asChild variant="soft">
                <Link href={`/kyc/${pro.id}`}>
                  <BadgeCheck /> Analisar verificação
                </Link>
              </Button>
            )}
            <DisabledHint hint={readOnlyReason}>
              <Button
                variant="outline"
                disabled={!canEdit}
                onClick={() => setRoleTarget({ id: user.id, name: user.name, role: user.role })}
              >
                <Pencil /> Editar tipo
              </Button>
            </DisabledHint>
            <DisabledHint hint={readOnlyReason}>
              <Button
                variant={user.isActive ? "destructive" : "default"}
                disabled={!canEdit}
                onClick={() => setActiveTarget({ id: user.id, name: user.name, isActive: user.isActive })}
              >
                {user.isActive ? <Ban /> : <ShieldCheck />}
                {user.isActive ? "Bloquear" : "Desbloquear"}
              </Button>
            </DisabledHint>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarClock} tone="navy" label="Solicitações como cliente" value={`${data.clientSummary.tasksCount} (${data.clientSummary.completedCount} concluídas)`} />
        <StatCard icon={Banknote} tone="brand" label="Total gasto" value={formatBRL(data.clientSummary.totalSpent)} />
        <StatCard
          icon={Star}
          tone="warning"
          label={`Avaliação como cliente (${data.clientSummary.ratingAsClientCount})`}
          value={data.clientSummary.ratingAsClient > 0 ? data.clientSummary.ratingAsClient.toFixed(1).replace(".", ",") : "—"}
        />
        <StatCard icon={CalendarClock} tone="sky" label="Última solicitação" value={formatDate(data.clientSummary.lastTaskAt)} />
      </div>

      {pro && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Star} tone="warning" label="Avaliação média" value={pro.rating > 0 ? pro.rating.toFixed(1).replace(".", ",") : "Novo"} />
          <StatCard icon={CalendarClock} tone="navy" label="Trampos concluídos" value={String(pro.totalTasks)} />
          <StatCard icon={Banknote} tone="sky" label="Ganhos totais" value={formatBRL(pro.balance.totalEarnings)} />
          <StatCard icon={Wallet} tone="success" label="Saldo disponível" value={formatBRL(pro.balance.available)} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Informações" contentClassName="pt-3">
          <InfoRow label="Telefone" value={user.phone} />
          <InfoRow label="E-mail" value={user.email || "—"} />
          <InfoRow label="Cadastro" value={formatDateTime(user.createdAt)} />
          <InfoRow label="ID no app" value={<PublicId code={user.publicCode} />} />
          <InfoRow label="ID interno" value={<span className="font-mono text-xs">{user.id}</span>} />
          <div className="pt-3">
            <VerificationLinks data={data} />
          </div>
        </SectionCard>

        {pro ? (
          <SectionCard
            title="Perfil profissional"
            contentClassName="pt-3"
            action={<KycBadge status={pro.kycStatus} />}
          >
            <InfoRow label="Verificação enviada" value={formatDateTime(pro.kycSubmittedAt)} />
            {pro.kycApprovedAt && <InfoRow label="Aprovado em" value={formatDateTime(pro.kycApprovedAt)} />}
            {pro.kycRejectedAt && <InfoRow label="Rejeitado em" value={formatDateTime(pro.kycRejectedAt)} />}
            {pro.kycRejectReason && <InfoRow label="Motivo da rejeição" value={pro.kycRejectReason} />}
            <InfoRow label="Sacado" value={formatBRL(pro.balance.withdrawn)} />
            <InfoRow label="Chave Pix" value={pro.pixKey || "—"} />
            <div className="flex flex-wrap gap-2 pt-3">
              <Button asChild size="sm" variant="outline">
                <Link href={`/kyc/${pro.id}`}>Ver documentos da verificação</Link>
              </Button>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Perfil profissional">
            <EmptyState
              icon={BadgeCheck}
              title="Não é profissional"
              description="O usuário ainda não ativou a conta profissional no app."
              className="py-8"
            />
          </SectionCard>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TaskList title="Trampos como cliente" tasks={data.tasksAsClient} empty="Nenhum trampo contratado" />
        <TaskList title="Trampos como profissional" tasks={data.tasksAsTasker} empty="Nenhum trampo realizado" />
      </div>

      <SectionCard title="Avaliações recebidas" description="Últimas 5" contentClassName="pt-3">
        {data.reviews.length === 0 ? (
          <EmptyState icon={Star} title="Nenhuma avaliação" className="py-8" />
        ) : (
          <ul>
            {data.reviews.map((r) => (
              <li key={r.id} className="border-b border-border/60 py-3 last:border-0">
                <div className="flex items-center gap-2">
                  <StarRow value={r.rating} />
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-foreground">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <RoleDialog target={roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)} />
      <UserActiveDialog target={activeTarget} onOpenChange={(o) => !o && setActiveTarget(null)} />
    </div>
  );
}
