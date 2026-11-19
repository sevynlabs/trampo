import { Suspense } from "react";
import { LoadingState } from "@/components/ds/states";
import { DisputesView } from "@/features/disputes/components/disputes-view";

export const metadata = { title: "Disputas · Trampo Admin" };

export default function DisputesPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <DisputesView />
    </Suspense>
  );
}
