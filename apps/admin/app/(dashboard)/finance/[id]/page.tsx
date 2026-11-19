"use client";

import { use } from "react";
import { ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ds";
import { PAYMENT_STATUS } from "@/constants/status";
import { formatDateTime } from "@/lib/format";
import { shortId, usePayment } from "@/features/finance/api";
import { PaymentDetailContent } from "@/features/finance/components/payment-detail";

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = usePayment(id);
  const p = q.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Pagamentos", href: "/finance" }, { label: shortId(id) }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p?.task?.title ?? "Pagamento"}
            {p && <StatusBadge map={PAYMENT_STATUS} status={p.status} />}
          </span>
        }
        description={p ? `${shortId(p.id)} · criado em ${formatDateTime(p.timeline.createdAt)}` : undefined}
      />

      {q.isLoading ? (
        <LoadingState rows={8} />
      ) : q.error ? (
        <ErrorState title="Pagamento não encontrado" description={q.error.message} onRetry={() => q.refetch()} />
      ) : p ? (
        <PaymentDetailContent p={p} columns={2} />
      ) : null}
    </div>
  );
}
