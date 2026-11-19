"use client";

import { useRef } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { ErrorState, LoadingState, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PAYMENT_STATUS } from "@/constants/status";
import { formatDateTime } from "@/lib/format";
import { shortId, usePayment } from "../api";
import { PaymentDetailContent } from "./payment-detail";

export function PaymentDetailSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  // Keep the last id while the drawer animates closed, so content doesn't flash.
  const lastId = useRef(id);
  if (id) lastId.current = id;
  const shownId = id ?? lastId.current;
  const q = usePayment(shownId);
  const p = q.data;
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby="payment-detail-desc">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-mono">{shownId ? shortId(shownId) : "Pagamento"}</SheetTitle>
            {p && <StatusBadge map={PAYMENT_STATUS} status={p.status} />}
          </div>
          <SheetDescription id="payment-detail-desc">
            {p ? `${p.task?.title ?? "Pagamento"} · criado em ${formatDateTime(p.timeline.createdAt)}` : "Carregando detalhes…"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {q.isLoading ? (
            <LoadingState rows={8} />
          ) : q.error ? (
            <ErrorState description={q.error.message} onRetry={() => q.refetch()} />
          ) : p ? (
            <PaymentDetailContent p={p} />
          ) : null}
        </SheetBody>
        <SheetFooter>
          {shownId && (
            <Button asChild variant="ghost" className="mr-auto">
              <Link href={`/finance/${shownId}`}>
                <Maximize2 /> Abrir página
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
