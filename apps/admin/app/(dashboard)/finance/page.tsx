import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { PaymentsView } from "@/features/finance/components/payments-view";

export const metadata = { title: "Pagamentos · Trampo Admin" };

export default function FinancePage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <PaymentsView />
    </Suspense>
  );
}
