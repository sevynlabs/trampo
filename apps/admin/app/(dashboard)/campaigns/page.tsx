"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Mail, Bell, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  SCHEDULED: { label: "Agendada", variant: "warning" },
  SENDING: { label: "Enviando", variant: "warning" },
  SENT: { label: "Enviada", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
};

export default function CampaignsPage() {
  const router = useRouter();
  const query = trpc.admin.campaigns.list.useQuery();
  const emailStatus = trpc.admin.campaigns.emailStatus.useQuery();
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground">
            Notificações push e email marketing
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/campaigns/templates">
              <FileText className="mr-2 h-4 w-4" /> Templates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Link>
          </Button>
        </div>
      </div>

      {emailStatus.data?.mode === "dev" && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-muted-foreground">
          Email em <strong>modo dev</strong>: mensagens são registradas no log,
          não enviadas. Configure <code>RESEND_API_KEY</code> para envio real.
          Push funciona normalmente via Expo.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma campanha ainda. Crie a primeira.
                  </TableCell>
                </TableRow>
              )}

              {data?.map((c) => {
                const st = STATUS[c.status] ?? STATUS.DRAFT;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/campaigns/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {c.channel === "PUSH" ? (
                          <Bell className="h-3.5 w-3.5" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        {c.channel === "PUSH" ? "Push" : "Email"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.sentCount}/{c.recipientCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {c.failedCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.sentAt ? formatDateTime(c.sentAt) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
