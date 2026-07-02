"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function DocumentPanel({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
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
            <img
              src={url}
              alt={label}
              className="h-56 w-full rounded-md border bg-muted object-contain"
            />
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

export default function KycReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const profileId = params.id;
  const router = useRouter();
  const utils = trpc.useUtils();
  const query = trpc.admin.getKycDetails.useQuery({ profileId });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const onSettled = async () => {
    await Promise.all([
      utils.admin.getKycDetails.invalidate({ profileId }),
      utils.admin.listPendingKyc.invalidate(),
      utils.admin.dashboardStats.invalidate(),
    ]);
  };

  const approve = trpc.admin.approveKyc.useMutation({
    onSuccess: async () => {
      await onSettled();
      router.push("/kyc");
    },
    onError: (e) => setActionError(e.message),
  });

  const reject = trpc.admin.rejectKyc.useMutation({
    onSuccess: async () => {
      setRejectOpen(false);
      await onSettled();
      router.push("/kyc");
    },
    onError: (e) => setActionError(e.message),
  });

  const data = query.data;
  const isPending = data?.kycStatus === "SUBMITTED";
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/kyc"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para a fila
      </Link>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError || !data ? (
        <p className="text-destructive">Não foi possível carregar este KYC.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {data.user.name || "Sem nome"}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{data.user.phone}</span>
                {data.user.email && <span>{data.user.email}</span>}
                <KycBadge status={data.kycStatus} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Enviado em {formatDateTime(data.submittedAt)}
              </p>
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
                    approve.mutate({ profileId });
                  }}
                >
                  {approve.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Aprovar
                </Button>
              </div>
            )}
          </div>

          {actionError && (
            <p className="text-sm font-medium text-destructive">{actionError}</p>
          )}

          {!isPending && (
            <Card>
              <CardContent className="py-4 text-sm">
                Este KYC já foi{" "}
                <span className="font-medium">
                  {data.kycStatus === "APPROVED" ? "aprovado" : "reprovado"}
                </span>
                {data.rejectReason && ` — motivo: ${data.rejectReason}`}.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <DocumentPanel label="Documento (frente)" url={data.documents.front} />
            <DocumentPanel label="Documento (verso)" url={data.documents.back} />
            <DocumentPanel label="Selfie" url={data.documents.selfie} />
          </div>

          {data.decisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de decisões</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.decisions.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between border-b py-2 text-sm last:border-0"
                  >
                    <div>
                      <span className="font-medium">
                        {d.decision === "APPROVED" ? "Aprovado" : "Reprovado"}
                      </span>
                      <span className="text-muted-foreground"> por {d.adminName}</span>
                      {d.reason && (
                        <p className="text-muted-foreground">Motivo: {d.reason}</p>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(d.createdAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar KYC</DialogTitle>
            <DialogDescription>
              Informe o motivo. O profissional será notificado e poderá reenviar
              os documentos.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Documento ilegível, selfie não corresponde ao documento..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          {actionError && (
            <p className="text-sm font-medium text-destructive">{actionError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reject.isPending || reason.trim().length < 3}
              onClick={() => {
                setActionError(null);
                reject.mutate({ profileId, reason: reason.trim() });
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
