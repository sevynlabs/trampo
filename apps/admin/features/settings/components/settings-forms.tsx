"use client";

import { useEffect } from "react";
import { Controller, useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Loader2 } from "lucide-react";
import { Field, FormSection, InfoCard, SectionCard, SettingRow } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/format";
import { useUpdateSettings, type PlatformSettings, type SettingsUpdate } from "../api";

type SettingsData = { settings: PlatformSettings; updatedAt: string | null };

/** Footer with dirty-state aware "Salvar alterações" / "Descartar". */
function SaveBar<T extends FieldValues>({
  form,
  saving,
  readOnly,
  updatedAt,
}: {
  form: UseFormReturn<T>;
  saving: boolean;
  readOnly: boolean;
  updatedAt: string | null;
}) {
  const dirty = form.formState.isDirty;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground">
        {dirty ? "Há alterações não salvas." : updatedAt ? `Última alteração em ${formatDateTime(updatedAt)}` : "Valores padrão da plataforma."}
      </span>
      {!readOnly && (
        <div className="flex gap-2">
          <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => form.reset()}>
            Descartar
          </Button>
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}

/** Shared wiring: reset from server data, submit a partial update, keep the form clean after save. */
function useSettingsForm<T extends FieldValues>(
  schema: z.ZodType<T, z.ZodTypeDef, T>,
  data: SettingsData,
  toValues: (s: PlatformSettings) => T,
  toUpdate: (v: T) => SettingsUpdate,
  message: string
) {
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues: toValues(data.settings) as never });
  const update = useUpdateSettings(message);
  useEffect(() => {
    form.reset(toValues(data.settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.settings]);
  const onSubmit = form.handleSubmit((v) => update.mutate(toUpdate(v)));
  return { form, update, onSubmit };
}

// ---- Plataforma ---------------------------------------------------------------

const platformSchema = z.object({
  platformName: z.string().trim().min(1, "Informe o nome").max(60, "Máximo de 60 caracteres"),
  supportEmail: z.string().trim().email("E-mail inválido").or(z.literal("")),
  supportPhone: z.string().trim().max(30, "Máximo de 30 caracteres"),
  maintenanceMode: z.boolean(),
});
type PlatformValues = z.infer<typeof platformSchema>;

export function PlatformForm({ data, readOnly }: { data: SettingsData; readOnly: boolean }) {
  const { form, update, onSubmit } = useSettingsForm<PlatformValues>(
    platformSchema,
    data,
    (s) => ({ platformName: s.platformName, supportEmail: s.supportEmail, supportPhone: s.supportPhone, maintenanceMode: s.maintenanceMode }),
    (v) => v,
    "Dados da plataforma salvos"
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionCard footer={<SaveBar form={form} saving={update.isPending} readOnly={readOnly} updatedAt={data.updatedAt} />}>
        <fieldset disabled={readOnly} className="contents">
          <FormSection title="Dados da plataforma" description="Nome exibido e canais de suporte mostrados aos usuários.">
            <Field label="Nome da plataforma" htmlFor="s-name" required error={errors.platformName?.message}>
              <Input id="s-name" aria-invalid={!!errors.platformName} {...form.register("platformName")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail de suporte" htmlFor="s-email" error={errors.supportEmail?.message}>
                <Input id="s-email" type="email" placeholder="suporte@trampo.app" aria-invalid={!!errors.supportEmail} {...form.register("supportEmail")} />
              </Field>
              <Field label="Telefone de suporte" htmlFor="s-phone" error={errors.supportPhone?.message}>
                <Input id="s-phone" type="tel" placeholder="(11) 99999-9999" aria-invalid={!!errors.supportPhone} {...form.register("supportPhone")} />
              </Field>
            </div>
          </FormSection>
          <FormSection title="Disponibilidade" description="Sinaliza manutenção programada.">
            <Controller
              control={form.control}
              name="maintenanceMode"
              render={({ field }) => (
                <SettingRow
                  title="Modo manutenção"
                  description="Registra que a plataforma está em manutenção. Por enquanto é informativo: o app ainda não bloqueia o acesso."
                  control={<Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} aria-label="Modo manutenção" />}
                />
              )}
            />
          </FormSection>
        </fieldset>
      </SectionCard>
    </form>
  );
}

// ---- Financeiro ---------------------------------------------------------------

const pct = z
  .number({ invalid_type_error: "Informe um número" })
  .min(0, "Mínimo 0%")
  .max(100, "Máximo 100%");
const reais = z.number({ invalid_type_error: "Informe um valor" }).min(0, "Não pode ser negativo").max(1_000_000, "Valor muito alto");
const financeSchema = z.object({
  clientFeePercent: pct,
  taskerFeePercent: pct,
  urgencyFeePercent: pct,
  minTaskValue: reais,
  withdrawalMinAmount: reais,
});
type FinanceValues = z.infer<typeof financeSchema>;

function SuffixInput({ suffix, prefix, ...props }: React.ComponentProps<typeof Input> & { suffix?: string; prefix?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input {...props} className={`${prefix ? "pl-10" : ""} ${suffix ? "pr-9" : ""} tabular-nums`} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function FinanceForm({ data, readOnly }: { data: SettingsData; readOnly: boolean }) {
  const { form, update, onSubmit } = useSettingsForm<FinanceValues>(
    financeSchema,
    data,
    (s) => ({
      clientFeePercent: s.clientFeePercent,
      taskerFeePercent: s.taskerFeePercent,
      urgencyFeePercent: s.urgencyFeePercent,
      minTaskValue: s.minTaskValue / 100,
      withdrawalMinAmount: s.withdrawalMinAmount / 100,
    }),
    (v) => ({
      clientFeePercent: v.clientFeePercent,
      taskerFeePercent: v.taskerFeePercent,
      urgencyFeePercent: v.urgencyFeePercent,
      minTaskValue: Math.round(v.minTaskValue * 100),
      withdrawalMinAmount: Math.round(v.withdrawalMinAmount * 100),
    }),
    "Parâmetros financeiros salvos"
  );
  const { errors } = form.formState;
  const num = { valueAsNumber: true } as const;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <InfoCard icon={Info} tone="warning" title="Valores informativos">
        Estes parâmetros ficam registrados, mas o cálculo de taxas e o saque mínimo ainda usam as constantes do sistema. Alterá-los
        aqui não muda cobranças nem repasses por enquanto.
      </InfoCard>
      <SectionCard footer={<SaveBar form={form} saving={update.isPending} readOnly={readOnly} updatedAt={data.updatedAt} />}>
        <fieldset disabled={readOnly} className="contents">
          <FormSection title="Taxas" description="Percentuais aplicados sobre o valor do serviço.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Taxa do cliente" htmlFor="f-client" error={errors.clientFeePercent?.message}>
                <SuffixInput id="f-client" type="number" step="0.1" min={0} max={100} suffix="%" aria-invalid={!!errors.clientFeePercent} {...form.register("clientFeePercent", num)} />
              </Field>
              <Field label="Taxa do profissional" htmlFor="f-tasker" error={errors.taskerFeePercent?.message}>
                <SuffixInput id="f-tasker" type="number" step="0.1" min={0} max={100} suffix="%" aria-invalid={!!errors.taskerFeePercent} {...form.register("taskerFeePercent", num)} />
              </Field>
              <Field label="Taxa de urgência" htmlFor="f-urgency" error={errors.urgencyFeePercent?.message}>
                <SuffixInput id="f-urgency" type="number" step="0.1" min={0} max={100} suffix="%" aria-invalid={!!errors.urgencyFeePercent} {...form.register("urgencyFeePercent", num)} />
              </Field>
            </div>
          </FormSection>
          <FormSection title="Limites" description="Valores em reais.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor mínimo da solicitação" htmlFor="f-min" error={errors.minTaskValue?.message}>
                <SuffixInput id="f-min" type="number" step="0.01" min={0} prefix="R$" aria-invalid={!!errors.minTaskValue} {...form.register("minTaskValue", num)} />
              </Field>
              <Field label="Saque mínimo" htmlFor="f-withdraw" error={errors.withdrawalMinAmount?.message}>
                <SuffixInput id="f-withdraw" type="number" step="0.01" min={0} prefix="R$" aria-invalid={!!errors.withdrawalMinAmount} {...form.register("withdrawalMinAmount", num)} />
              </Field>
            </div>
          </FormSection>
        </fieldset>
      </SectionCard>
    </form>
  );
}

// ---- Notificações -------------------------------------------------------------

const notifSchema = z.object({
  emailOnNewDispute: z.boolean(),
  emailOnKycSubmitted: z.boolean(),
  dailySummary: z.boolean(),
});
type NotifValues = z.infer<typeof notifSchema>;

const NOTIFS: { key: keyof NotifValues; title: string; description: string }[] = [
  { key: "emailOnNewDispute", title: "E-mail a cada nova disputa", description: "Avisa a equipe quando um cliente ou profissional abre uma disputa." },
  { key: "emailOnKycSubmitted", title: "E-mail a cada verificação enviada", description: "Avisa quando um profissional envia documentos para análise (KYC)." },
  { key: "dailySummary", title: "Resumo diário", description: "Um e-mail por dia com os principais números da plataforma." },
];

export function NotificationsForm({ data, readOnly }: { data: SettingsData; readOnly: boolean }) {
  const { form, update, onSubmit } = useSettingsForm<NotifValues>(
    notifSchema,
    data,
    (s) => ({ ...s.notifications }),
    (v) => ({ notifications: v }),
    "Preferências de notificação salvas"
  );
  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionCard
        title="Notificações da equipe"
        description="Alertas enviados aos administradores."
        footer={<SaveBar form={form} saving={update.isPending} readOnly={readOnly} updatedAt={data.updatedAt} />}
      >
        <div className="grid gap-3">
          {NOTIFS.map((n) => (
            <Controller
              key={n.key}
              control={form.control}
              name={n.key}
              render={({ field }) => (
                <SettingRow
                  title={n.title}
                  description={n.description}
                  control={<Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} aria-label={n.title} />}
                />
              )}
            />
          ))}
        </div>
      </SectionCard>
    </form>
  );
}
