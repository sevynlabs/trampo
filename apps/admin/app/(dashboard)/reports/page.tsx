import { Suspense } from "react";
import { LoadingState } from "@/components/ds/states";
import { ReportsView } from "@/features/reports/components/reports-view";

export const metadata = { title: "Relatórios · Trampo Admin" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <ReportsView />
    </Suspense>
  );
}
