"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Check, CheckCircle2, Clock, X } from "lucide-react";
import {
  ConfirmDialog,
  DataTable,
  FilterBar,
  FilterSelect,
  InfoCard,
  PageHeader,
  RowActions,
  SectionCard,
  StatCard,
  StatusBadge,
  UserCell,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { WITHDRAWAL_STATUS } from "@/constants/status";
import { useUrlState } from "@/hooks/use-url-state";
import { formatBRL, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  usePayWithdrawal,
  usePendingWithdrawals,
  useRejectWithdrawal,
  useWithdrawals,
  type WithdrawalRow,
  type WithdrawalStatusFilter,
} from "../api";
import { FinanceNav } from "./finance-nav";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Em processamento" },
  { value: "PAID", label: "Pagos" },
  { value: "FAILED", label: "Rejeitados" },
];
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((o) => o.value));

export function WithdrawalsView() {
  const [url, setUrl] = useUrlState({ page: "1", status: "PENDING" });
  const status = (STATUS_VALUES.has(url.status) ? url.status : "PENDING") as WithdrawalStatusFilter;
  const page = Math.max(1, Number(url.page) || 1);

  const list = useWithdrawals({ page, pageSize: PAGE_SIZE, status });
  const pending = usePendingWithdrawals();
  const pw = pending.data;

  const [toPay, setToPay] = useState<WithdrawalRow | null>(null);
  const [toReject, setToReject] = useState<WithdrawalRow | null>(null);
  const pay = usePayWithdrawal({ onSuccess: () => setToPay(null) });
  const reject = useRejectWithdrawal({ onSuccess: () => setToReject(null) });
  const busy = pay.isPending || reject.isPending;

  const columns = useMemo<ColumnDef<WithdrawalRow, any>[]>(
    () => [
      {
        id: "tasker",
        header: "Profissional",
        cell: ({ row }) => (
          <UserCell name={row.original.taskerName} subtitle={row.original.taskerPhone ?? undefined} size="sm" className="min-w-[170px]" />
        ),
      },
      {
        id: "pixKey",
        header: "Chave Pix",
        cell: ({ row }) => <span className="break-all font-mono text-xs">{row.original.pixKey}</span>,
      },
      {
        id: "amount",
        header: "Valor",
        meta: { align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap font-semibold tabular-nums text-navy">{formatBRL(row.original.amount)}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            <StatusBadge map={WITHDRAWAL_STATUS} status={row.original.status} />
            {row.original.status === "FAILED" && row.original.failureReason && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.original.failureReason}</p>
            )}
          </div>
        ),
      },
      {
        id: "createdAt",
        header: "Solicitado em",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div>{formatDate(row.original.createdAt)}</div>
            {row.original.paidAt && (
              <div className="text-2xs text-muted-foreground">Pago {formatDateTime(row.original.paidAt)}</div>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.status === "PENDING" ? (
            <RowActions>
              <div className="flex gap-2">
                <Button size="xs" variant="navy" disabled={busy} onClick={() => setToPay(row.original)}>
                  <Check /> Pagar
                </Button>
                <Button size="xs" variant="outline" disabled={busy} onClick={() => setToReject(row.original)}>
                  <X /> Rejeitar
                </Button>
              </div>
            </RowActions>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [busy]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saques"
        description="Solicitações de saque dos profissionais via Pix"
        breadcrumb={[{ label: "Pagamentos", href: "/finance" }, { label: "Saques" }]}
        actions={<FinanceNav pendingWithdrawals={pw?.total} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} tone="warning" label="Valor pendente" value={pw ? formatBRL(pw.pendingTotal) : undefined} />
        <StatCard icon={Clock} tone="navy" label="Saques em processamento" value={pw ? formatNumber(pw.total) : undefined} />
      </div>

      <InfoCard icon={CheckCircle2} title="Como pagar um saque" tone="sky">
        Envie o Pix para a chave do profissional pelo banco/Asaas e só então marque o saque como pago aqui.
      </InfoCard>

      <SectionCard>
        <div className="space-y-4">
          <FilterBar>
            <FilterSelect label="Status" value={status} onChange={(v) => setUrl({ status: v })} options={STATUS_OPTIONS} className="min-w-[200px]" />
          </FilterBar>
          <DataTable
            columns={columns}
            data={list.data?.withdrawals}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(w) => w.id}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: list.data?.total ?? 0,
              onPageChange: (p) => setUrl({ page: String(p) }, { resetPage: false }),
            }}
            empty={{
              icon: Banknote,
              title: status === "PENDING" ? "Nenhum saque pendente" : "Nenhum saque encontrado",
              description: status === "PENDING" ? "Tudo em dia por aqui." : "Tente outro status.",
            }}
          />
        </div>
      </SectionCard>

      <ConfirmDialog
        open={!!toPay}
        onOpenChange={(o) => !o && setToPay(null)}
        title="Confirmar pagamento do saque"
        description={
          toPay && (
            <>
              Marcar <b>{formatBRL(toPay.amount)}</b> para <b>{toPay.taskerName ?? "profissional"}</b> (Pix{" "}
              <span className="font-mono">{toPay.pixKey}</span>) como pago? Faça isso somente depois de enviar o Pix.
            </>
          )
        }
        confirmLabel="Marcar como pago"
        loading={pay.isPending}
        onConfirm={() => toPay && pay.mutate({ id: toPay.id })}
      />

      <ConfirmDialog
        open={!!toReject}
        onOpenChange={(o) => !o && setToReject(null)}
        title="Rejeitar saque"
        description={
          toReject && (
            <>
              Rejeitar o saque de <b>{formatBRL(toReject.amount)}</b> de <b>{toReject.taskerName ?? "profissional"}</b>? O
              profissional verá o motivo informado.
            </>
          )
        }
        confirmLabel="Rejeitar saque"
        tone="danger"
        requireReason
        reasonLabel="Motivo da rejeição"
        reasonPlaceholder="Ex.: chave Pix inválida"
        loading={reject.isPending}
        onConfirm={(reason) => toReject && reason && reject.mutate({ id: toReject.id, reason })}
      />
    </div>
  );
}
