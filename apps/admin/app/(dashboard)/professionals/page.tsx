"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Search, Star, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "verification" | "rejected" | "blocked";
const PAGE_SIZE = 20;

function ProStatus({ kyc, active }: { kyc: string; active: boolean }) {
  const [label, cls] = !active
    ? ["Bloqueado", "bg-red-100 text-red-700"]
    : kyc === "APPROVED"
      ? ["Ativo", "bg-emerald-100 text-emerald-700"]
      : kyc === "REJECTED"
        ? ["Rejeitado", "bg-red-100 text-red-700"]
        : ["Verificação", "bg-brand-soft text-brand"];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", cls)}>{label}</span>;
}

function Initials({ name }: { name: string | null }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
      {initials || "?"}
    </div>
  );
}

export default function ProfessionalsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => setPage(1), [status]);

  const query = trpc.admin.listProfessionals.useQuery(
    { page, pageSize: PAGE_SIZE, search: search || undefined, status },
    { placeholderData: keepPreviousData }
  );
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profissionais</h1>
          <p className="text-muted-foreground">Gerencie os profissionais da plataforma</p>
        </div>
        <Button onClick={() => router.push("/kyc")}>Fila de verificação</Button>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou categoria..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="verification">Em verificação</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead className="text-right">Serviços</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data && data.professionals.length > 0 ? (
                data.professionals.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/users/${p.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Initials name={p.name} />
                        <div>
                          <div className="font-semibold">{p.name || <span className="text-muted-foreground">Sem nome</span>}</div>
                          <div className="text-xs text-muted-foreground">{p.phone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.categories.length ? (
                        <span>
                          {p.categories[0]}
                          {p.categories.length > 1 && <span className="text-muted-foreground"> +{p.categories.length - 1}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.rating > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold">{p.rating.toFixed(1).replace(".", ",")}</span>
                          <span className="text-muted-foreground">({p.reviewCount})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem avaliações</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{p.totalTasks}</TableCell>
                    <TableCell className="text-right">{formatBRL(p.totalEarnings)}</TableCell>
                    <TableCell>
                      <ProStatus kyc={p.kycStatus} active={p.isActive} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhum profissional encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data ? `${data.total} profissional(is)` : ""}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {data?.page ?? page} de {data?.totalPages ?? 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || page >= data.totalPages || query.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
