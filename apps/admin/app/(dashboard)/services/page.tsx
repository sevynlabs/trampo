import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { ServicesView } from "@/features/services/components/services-view";

export const metadata = { title: "Serviços · Trampo Admin" };

export default function ServicesPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <ServicesView />
    </Suspense>
  );
}
