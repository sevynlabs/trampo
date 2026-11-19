import { Suspense } from "react";
import { LoadingState } from "@/components/ds/states";
import { CouponsView } from "@/features/campaigns/components/coupons-view";

export const metadata = { title: "Cupons · Trampo Admin" };

export default function CouponsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <CouponsView />
    </Suspense>
  );
}
