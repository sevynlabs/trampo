import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { WithdrawalsView } from "@/features/finance/components/withdrawals-view";

export const metadata = { title: "Saques · Trampo Admin" };

export default function WithdrawalsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <WithdrawalsView />
    </Suspense>
  );
}
