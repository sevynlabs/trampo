import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { RequestsView } from "@/features/requests/components/requests-view";

export const metadata = { title: "Solicitações · Trampo Admin" };

export default function RequestsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <RequestsView />
    </Suspense>
  );
}
