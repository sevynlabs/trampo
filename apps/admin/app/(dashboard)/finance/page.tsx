"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Wallet, TrendingUp, Banknote, RotateCcw, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { PaymentStatusBadge } from "@/components/status-badges";
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
import { formatBRL, formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "CONFIRMED", label: "Pago" },
  { value: "HELD", label: "Em custódia" },
  { value: "RELEASED", label: "Liberado" },
  { value: "REFUNDED", label: "Reembolsado" },
  { value: "DISPUTED", label: "Em disputa" },
  { value: "PENDING", label: "Aguardando" },
  { value: "EXPIRED", label: "Expirado" },
] as const;

export default function FinancePage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("ALL");

  useEffect(() => setPage(1), [status]);

  const report = trpc.admin.finance.revenueReport.useQuery({ days: 30 });
  const query = trpc.admin.finance.listPayments.useQuery(
    { page, pageSize: PAGE_SIZE, status: status as never },
    { placeholderData: keepPreviousData }
  );
  const data = query.data;
  const r = report.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">
            Pagamentos, receita e custódia — últimos 30 dias
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/finance/withdrawals">
            Saques <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="GMV (30d)"
          value={r ? formatBRL(r.gmv) : undefined}
          icon={TrendingUp}
        />
        <StatCard
          label="Receita (30d)"
          value={r ? formatBRL(r.platformRevenue) : undefined}
          icon={Wallet}
          hint={r ? `${r.paidCount} pagamentos` : undefined}
        />
        <StatCard
          label="Repasses (30d)"
          value={r ? formatBRL(r.taskerPayouts) : undefined}
          icon={Banknote}
        />
        <StatCard
          label="Reembolsos (30d)"
          value={r ? formatBRL(r.refundedAmount) : undefined}
          icon={RotateCcw}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Pagamentos</CardTitle>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trampo</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {data?.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum pagamento encontrado.
                  </TableCell>
                </TableRow>
              )}

              {data?.payments.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/finance/${p.id}`)}
                >
                  <TableCell className="max-w-48 truncate font-medium">
                    {p.taskTitle ?? "—"}
                  </TableCell>
                  <TableCell>{p.payerName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(p.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatBRL(p.platformFee)}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.total} pagamentos • página {data.page}/{data.totalPages}
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
    </div>
  );
}
