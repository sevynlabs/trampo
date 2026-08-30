"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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
  const query = trpc.admin.listPendingKyc.useQuery();
  const items = query.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fila de KYC</h1>
        <p className="text-muted-foreground">
          Profissionais aguardando verificação de documentos
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items && items.length > 0 ? (
              items.map((item) => (
                <TableRow
                  key={item.profileId}
                  className="cursor-pointer"
                  onClick={() => router.push(`/kyc/${item.profileId}`)}
                >
                  <TableCell className="font-medium">
                    {item.name || "Sem nome"}
                    {item.email && (
                      <div className="text-xs text-muted-foreground">
                        {item.email}
                      </div>
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
                        router.push(`/kyc/${item.profileId}`);
                      }}
                    >
                      Revisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Nenhum KYC pendente. Tudo em dia! 🎉
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
