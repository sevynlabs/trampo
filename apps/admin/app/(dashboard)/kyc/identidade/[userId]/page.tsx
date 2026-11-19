"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { KycBadge } from "@/components/status-badges";
import { formatDateTime } from "@/lib/utils";

function DocumentPanel({ label, url }: { label: string; url: string | null }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          {label}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
            >
              Abrir <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt={label} className="h-56 w-full rounded-md border bg-muted object-contain" />
          </a>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Não enviado
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ROLE_LABEL: Record<string, string> = {
  CLIENT: "Cliente",
  TASKER: "Profissional",
  BOTH: "Cliente e profissional",
};

/** Review of the minimum verification (identity document + selfie). */
export default function IdentityReviewPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const query = trpc.admin.identity.getDetails.useQuery({ userId });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const onDone = async () => {
    await Promise.all([
      utils.admin.identity.listPending.invalidate(),
      utils.admin.dashboardStats.invalidate(),
    ]);
    router.push("/kyc");
  };

  const approve = trpc.admin.identity.approve.useMutation({
    onSuccess: onDone,
    onError: (e) => setActionError(e.message),
  });
  const reject = trpc.admin.identity.reject.useMutation({
    onSuccess: async () => {
      setRejectOpen(false);
      await onDone();
    },
    onError: (e) => setActionError(e.message),
  });

  const data = query.data;
  const isPending = data?.status === "SUBMITTED";
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/kyc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a fila
      </Link>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError || !data ? (
        <p className="text-destructive">Não foi possível carregar esta verificação.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Verificação de identidade</p>
              <h1 className="text-2xl font-bold tracking-tight">{data.user.name || "Sem nome"}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{data.user.phone}</span>
                {data.user.email && <span>{data.user.email}</span>}
                <span>{ROLE_LABEL[data.user.role] ?? data.user.role}</span>
                <KycBadge status={data.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Enviado em {formatDateTime(data.submittedAt)}</p>
            </div>

            {isPending && (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setActionError(null);
                    setReason("");
                    setRejectOpen(true);
                  }}
                >
                  <X className="h-4 w-4" />
                  Reprovar
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setActionError(null);
                    approve.mutate({ userId });
                  }}
                >
                  {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprovar
                </Button>
              </div>
            )}
          </div>

          {actionError && <p className="text-sm font-medium text-destructive">{actionError}</p>}

          {!isPending && (
            <Card>
              <CardContent className="py-4 text-sm">
                Esta verificação está{" "}
                <span className="font-medium">
                  {data.status === "APPROVED" ? "aprovada" : data.status === "REJECTED" ? "reprovada" : "pendente"}
                </span>
                {data.rejectReason && ` — motivo: ${data.rejectReason}`}.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <DocumentPanel label="Documento (frente)" url={data.documents.front} />
            <DocumentPanel label="Documento (verso)" url={data.documents.back} />
            <DocumentPanel label="Selfie com documento" url={data.documents.selfie} />
          </div>

          <p className="text-xs text-muted-foreground">
            Com os documentos enviados a pessoa já pode publicar e contratar. Reprovar bloqueia essas ações até ela
            reenviar.
          </p>
        </>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar documentos</DialogTitle>
            <DialogDescription>
              Informe o motivo. A pessoa será notificada e poderá reenviar os documentos.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Documento ilegível, selfie não corresponde ao documento..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          {actionError && <p className="text-sm font-medium text-destructive">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reject.isPending || reason.trim().length < 3}
              onClick={() => {
                setActionError(null);
                reject.mutate({ userId, reason: reason.trim() });
              }}
            >
              {reject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
