"use client";

import { Bell, Building2, Lock, Monitor, Users, Wallet } from "lucide-react";
import { ErrorState, InfoCard, LoadingState, PageHeader, SectionCard } from "@/components/ds";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlState } from "@/hooks/use-url-state";
import { ADMIN_ROLE_LABEL } from "@/constants/status";
import { useMe, useSettings } from "../api";
import { FinanceForm, NotificationsForm, PlatformForm } from "./settings-forms";
import { PanelPreferences } from "./panel-preferences";
import { AdminsTab } from "./admins-tab";

const TABS = [
  { value: "platform", label: "Plataforma", icon: Building2 },
  { value: "finance", label: "Financeiro", icon: Wallet },
  { value: "notifications", label: "Notificações", icon: Bell },
  { value: "panel", label: "Preferências do painel", icon: Monitor },
  { value: "admins", label: "Administradores e permissões", icon: Users },
] as const;

export function SettingsView() {
  const [s, set] = useUrlState({ tab: "platform" });
  const tab = TABS.some((t) => t.value === s.tab) ? s.tab : "platform";
  const me = useMe();
  const settings = useSettings();
  const readOnly = !me.isSuperAdmin;

  const settingsSlot = (render: (data: NonNullable<typeof settings.data>) => React.ReactNode) =>
    settings.isLoading ? (
      <SectionCard>
        <LoadingState rows={5} />
      </SectionCard>
    ) : settings.error ? (
      <SectionCard>
        <ErrorState description={settings.error.message} onRetry={() => settings.refetch()} />
      </SectionCard>
    ) : settings.data ? (
      render(settings.data)
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Parâmetros da plataforma, notificações e acesso ao painel." />

      {me.data && readOnly && (
        <InfoCard icon={Lock} tone="warning" title="Somente leitura">
          Seu papel é {ADMIN_ROLE_LABEL[me.data.role] ?? me.data.role}. Apenas Super Admins podem alterar configurações e
          administradores.
        </InfoCard>
      )}

      <Tabs value={tab} onValueChange={(v) => set({ tab: v })}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="platform">{settingsSlot((d) => <PlatformForm data={d} readOnly={readOnly} />)}</TabsContent>
        <TabsContent value="finance">{settingsSlot((d) => <FinanceForm data={d} readOnly={readOnly} />)}</TabsContent>
        <TabsContent value="notifications">{settingsSlot((d) => <NotificationsForm data={d} readOnly={readOnly} />)}</TabsContent>
        <TabsContent value="panel">
          <PanelPreferences />
        </TabsContent>
        <TabsContent value="admins">
          <AdminsTab meId={me.data?.id} readOnly={readOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
