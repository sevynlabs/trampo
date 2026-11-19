import { Suspense } from "react";
import { LoadingState } from "@/components/ds/states";
import { SettingsView } from "@/features/settings/components/settings-view";

export const metadata = { title: "Configurações · Trampo Admin" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <SettingsView />
    </Suspense>
  );
}
