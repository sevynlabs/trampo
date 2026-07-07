"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/stat-card";
import { WithdrawalStatusBadge } from "@/components/status-badges";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Banknote } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendentes" },
  { value: "PAID", label: "Pagos" },
  { value: "FAILED", label: "Rejeitados" },
] as const;

export default function WithdrawalsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("PENDING");
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => setPage(1), [status]);

  const utils = trpc.useUtils();
  const query = trpc.admin.finance.listWithdrawals.useQuery(
    { page, pageSize: PAGE_SIZE, status: status as never },
    { placeholderData: keepPreviousData }
  );
  const data = query.data;

  const pay = trpc.admin.finance.payWithdrawal.useMutation({
    onSuccess: () => utils.admin.finance.listWithdrawals.invalidate(),
  });
  const reject = trpc.admin.finance.rejectWithdrawal.useMutation({
    onSuccess: () => {
      utils.admin.finance.listWithdrawals.invalidate();
      setRejecting(null);
      setReason("");
    },
  });

  const busy = pay.isPending || reject.isPending;

  return (
    <div className="space-y-6">
      <Link
        href="/finance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saques</h1>
        <p className="text-muted-foreground">
          Solicitações de saque dos profissionais (Pix)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total pendente"
          value={data ? formatBRL(data.pendingTotal) : undefined}
          icon={Banknote}
          highlight={!!data && data.pendingTotal > 0}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Solicitações</CardTitle>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {(pay.isError || reject.isError) && (
            <p className="mb-3 text-sm text-destructive">
              {pay.error?.message ?? reject.error?.message}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Chave Pix</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {data?.withdrawals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum saque encontrado.
                  </TableCell>
                </TableRow>
              )}

              {data?.withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.taskerName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{w.pixKey}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(w.amount)}
                  </TableCell>
                  <TableCell>
                    <WithdrawalStatusBadge status={w.status} />
                    {w.status === "FAILED" && w.failureReason && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {w.failureReason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(w.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {w.status === "PENDING" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Confirmar pagamento de ${formatBRL(w.amount)} para ${
                                  w.taskerName ?? "profissional"
                                }? Marque como pago somente após enviar o Pix.`
                              )
                            ) {
                              pay.mutate({ id: w.id });
                            }
                          }}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Pagar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setRejecting({ id: w.id, name: w.taskerName ?? "profissional" })
                          }
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.total} saques • página {data.page}/{data.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar saque</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o motivo da rejeição para {rejecting?.name}. O profissional verá esta
            mensagem.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: chave Pix inválida"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || reject.isPending}
              onClick={() =>
                rejecting && reject.mutate({ id: rejecting.id, reason: reason.trim() })
              }
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
