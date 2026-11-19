"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export default function KycQueuePage() {
  const router = useRouter();
  const proQuery = trpc.admin.listPendingKyc.useQuery();
  const idQuery = trpc.admin.identity.listPending.useQuery();
  const query = { isLoading: proQuery.isLoading || idQuery.isLoading };

  // One queue, two kinds: professionals (identity + criminal record) and
  // identity-only (minimum verification of clients). Oldest first.
  const items =
    proQuery.data && idQuery.data
      ? [
          ...proQuery.data.map((p) => ({
            key: `pro-${p.profileId}`,
            kind: "pro" as const,
            href: `/kyc/${p.profileId}`,
            name: p.name,
            email: p.email,
            phone: p.phone,
            submittedAt: p.submittedAt,
          })),
          ...idQuery.data.map((u) => ({
            key: `id-${u.userId}`,
            kind: "identity" as const,
            href: `/kyc/identidade/${u.userId}`,
            name: u.name,
            email: u.email,
            phone: u.phone,
            submittedAt: u.submittedAt,
          })),
        ].sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fila de verificação</h1>
        <p className="text-muted-foreground">
          Identidade (todos os usuários) e conta profissional (identidade +
          antecedentes criminais)
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items && items.length > 0 ? (
              items.map((item) => (
                <TableRow
                  key={item.key}
                  className="cursor-pointer"
                  onClick={() => router.push(item.href)}
                >
                  <TableCell className="font-medium">
                    {item.name || "Sem nome"}
                    {item.email && (
                      <div className="text-xs text-muted-foreground">
                        {item.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.kind === "pro" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        <ShieldCheck className="h-3 w-3" /> Profissional
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                        <BadgeCheck className="h-3 w-3" /> Identidade
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{item.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(item.submittedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(item.href);
                      }}
                    >
                      Revisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Nenhuma verificação pendente. Tudo em dia! 🎉
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
