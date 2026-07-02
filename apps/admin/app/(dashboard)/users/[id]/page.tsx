"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RoleBadge,
  KycBadge,
  UserStatusBadge,
} from "@/components/status-badges";
import { formatBRL, formatDate, formatDateTime } from "@/lib/utils";

const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  RELEASED: "Liberado",
  CANCELLED: "Cancelado",
  DISPUTED: "Disputa",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function UserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const utils = trpc.useUtils();
  const query = trpc.admin.getUser.useQuery({ id });

  const setActive = trpc.admin.setUserActive.useMutation({
    onSuccess: () => utils.admin.getUser.invalidate({ id }),
  });
  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => utils.admin.getUser.invalidate({ id }),
  });

  const data = query.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para usuários
      </Link>

      {query.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError || !data ? (
        <p className="text-destructive">Usuário não encontrado.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {data.user.name || "Sem nome"}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <RoleBadge role={data.user.role} />
                  <UserStatusBadge active={data.user.isActive} />
                  <KycBadge status={data.taskerProfile?.kycStatus ?? null} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={data.user.role}
                onValueChange={(role) =>
                  setRole.mutate({ id, role: role as "CLIENT" | "TASKER" | "BOTH" })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Cliente</SelectItem>
                  <SelectItem value="TASKER">Profissional</SelectItem>
                  <SelectItem value="BOTH">Ambos</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={data.user.isActive ? "destructive" : "default"}
                disabled={setActive.isPending}
                onClick={() => {
                  const active = !data.user.isActive;
                  if (
                    window.confirm(
                      active
                        ? "Desbloquear este usuário?"
                        : "Bloquear este usuário? Ele não poderá usar o app."
                    )
                  ) {
                    setActive.mutate({ id, active });
                  }
                }}
              >
                {setActive.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {data.user.isActive ? "Bloquear" : "Desbloquear"}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Telefone" value={data.user.phone} />
                <InfoRow label="E-mail" value={data.user.email || "—"} />
                <InfoRow
                  label="Cadastro"
                  value={formatDate(data.user.createdAt)}
                />
                <InfoRow
                  label="ID"
                  value={
                    <span className="font-mono text-xs">{data.user.id}</span>
                  }
                />
              </CardContent>
            </Card>

            {data.taskerProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profissional</CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow
                    label="Avaliação"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {data.taskerProfile.rating.toFixed(1)}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Trampos concluídos"
                    value={data.taskerProfile.totalTasks}
                  />
                  <InfoRow
                    label="Ganhos totais"
                    value={formatBRL(data.taskerProfile.balance.totalEarnings)}
                  />
                  <InfoRow
                    label="Sacado"
                    value={formatBRL(data.taskerProfile.balance.withdrawn)}
                  />
                  <InfoRow
                    label="Saldo disponível"
                    value={
                      <span className="font-semibold text-emerald-600">
                        {formatBRL(data.taskerProfile.balance.available)}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Chave Pix"
                    value={data.taskerProfile.pixKey || "—"}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <TaskList
              title="Trampos como cliente"
              tasks={data.tasksAsClient}
              statusLabels={TASK_STATUS_LABELS}
            />
            <TaskList
              title="Trampos como profissional"
              tasks={data.tasksAsTasker}
              statusLabels={TASK_STATUS_LABELS}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avaliações recebidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma avaliação.
                </p>
              ) : (
                data.reviews.map((r) => (
                  <div key={r.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={
                            i < r.rating
                              ? "h-3.5 w-3.5 fill-amber-400 text-amber-400"
                              : "h-3.5 w-3.5 text-muted-foreground/30"
                          }
                        />
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-sm">{r.comment}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TaskList({
  title,
  tasks,
  statusLabels,
}: {
  title: string;
  tasks: { id: string; title: string; status: string; value: number; createdAt: string }[];
  statusLabels: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum trampo.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(t.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline">
                  {statusLabels[t.status] ?? t.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatBRL(t.value)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
