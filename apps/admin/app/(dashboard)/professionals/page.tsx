"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { ProfessionalsList } from "@/features/professionals/components/professionals-list";

export default function ProfessionalsPage() {
  return (
    <Suspense fallback={<LoadingState rows={8} />}>
      <ProfessionalsList />
    </Suspense>
  );
}
