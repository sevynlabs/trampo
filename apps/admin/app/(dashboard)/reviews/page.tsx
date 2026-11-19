import { Suspense } from "react";
import { LoadingState } from "@/components/ds/states";
import { ReviewsView } from "@/features/reviews/components/reviews-view";

export const metadata = { title: "Avaliações · Trampo Admin" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <ReviewsView />
    </Suspense>
  );
}
