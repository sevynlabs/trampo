import { Suspense } from "react";
import { LoadingState } from "@/components/ds/states";
import { CampaignsView } from "@/features/campaigns/components/campaigns-view";

export const metadata = { title: "Campanhas · Trampo Admin" };

export default function CampaignsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <CampaignsView />
    </Suspense>
  );
}
