"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Loader2, Mail, Users } from "lucide-react";
import { Field, FormSection, SectionCard, SettingRow } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { useCreateCampaign, useSegmentPreview, useTemplates, type CampaignChannel, type Segment } from "../api";

const schema = z.object({
  name: z.string().trim().min(2, "Dê um nome com pelo menos 2 caracteres").max(120, "Máximo de 120 caracteres"),
  channel: z.enum(["PUSH", "EMAIL"]),
  role: z.enum(["ALL", "CLIENT", "TASKER", "BOTH"]),
  kycStatus: z.enum(["ANY", "APPROVED", "SUBMITTED", "PENDING", "REJECTED"]),
  activeWithinDays: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 365), "Informe de 1 a 365 dias ou deixe vazio"),
  onlyActive: z.boolean(),
  title: z.string().trim().min(2, "Mínimo de 2 caracteres"),
  body: z.string().trim().min(2, "Mínimo de 2 caracteres"),
  emailTemplateId: z.string(),
});
type Values = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "CLIENT", label: "Clientes" },
  { value: "TASKER", label: "Profissionais" },
  { value: "BOTH", label: "Clientes e profissionais" },
];
const KYC_OPTIONS = [
  { value: "ANY", label: "Qualquer" },
  { value: "APPROVED", label: "Verificado" },
  { value: "SUBMITTED", label: "Em análise" },
  { value: "PENDING", label: "Pendente" },
  { value: "REJECTED", label: "Rejeitado" },
];

function toSegment(v: Pick<Values, "role" | "kycStatus" | "activeWithinDays" | "onlyActive">): Segment | null {
  const days = v.activeWithinDays.trim();
  if (days && !(/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365)) return null;
  return {
    role: v.role,
    kycStatus: v.kycStatus,
    onlyActive: v.onlyActive,
    ...(days ? { activeWithinDays: Number(days) } : {}),
  };
}

function ChannelPicker({ value, onChange }: { value: CampaignChannel; onChange: (c: CampaignChannel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Canal">
      {(["PUSH", "EMAIL"] as const).map((c) => {
        const Icon = c === "PUSH" ? Bell : Mail;
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-navy/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "border-primary ring-2 ring-primary/20"
            )}
          >
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground")}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">{c === "PUSH" ? "Notificação push" : "E-mail"}</span>
              <span className="block text-xs text-muted-foreground">
                {c === "PUSH" ? "Usuários com o app e push ativo" : "Usuários com e-mail cadastrado"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "Nova campanha": creates a DRAFT (admin.campaigns.create); sending happens on the detail page. */
export function CampaignForm() {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      channel: "PUSH",
      role: "ALL",
      kycStatus: "ANY",
      activeWithinDays: "",
      onlyActive: true,
      title: "",
      body: "",
      emailTemplateId: "",
    },
  });
  const { errors } = form.formState;
  const [channel, role, kycStatus, activeWithinDays, onlyActive] = form.watch(["channel", "role", "kycStatus", "activeWithinDays", "onlyActive"]);
  const debouncedDays = useDebouncedValue(activeWithinDays, 400);
  const segment = useMemo(
    () => toSegment({ role, kycStatus, activeWithinDays: debouncedDays, onlyActive }),
    [role, kycStatus, debouncedDays, onlyActive]
  );

  const preview = useSegmentPreview(channel, segment);
  const templates = useTemplates(channel === "EMAIL");
  const activeTemplates = templates.data?.filter((t) => t.isActive) ?? [];
  const create = useCreateCampaign((id) => router.push(`/campaigns/${id}`));

  const onSubmit = form.handleSubmit((v) => {
    const seg = toSegment(v);
    if (!seg) return;
    create.mutate({
      name: v.name.trim(),
      channel: v.channel,
      segment: seg,
      title: v.title.trim(),
      body: v.body.trim(),
      ...(v.channel === "EMAIL" && v.emailTemplateId ? { emailTemplateId: v.emailTemplateId } : {}),
    });
  });

  const isPush = channel === "PUSH";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <SectionCard>
        <FormSection title="Canal e nome" description="O nome é interno — os usuários não o veem.">
          <Controller
            control={form.control}
            name="channel"
            render={({ field }) => (
              <ChannelPicker
                value={field.value}
                onChange={(c) => {
                  field.onChange(c);
                  if (c === "PUSH") form.setValue("emailTemplateId", "");
                }}
              />
            )}
          />
          <Field label="Nome interno" htmlFor="c-name" required error={errors.name?.message}>
            <Input id="c-name" placeholder="Ex.: Reativação de clientes inativos" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
        </FormSection>

        <FormSection title="Público-alvo" description="O segmento é resolvido no momento do envio.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de usuário">
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Tipo de usuário">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Verificação do profissional">
              <Controller
                control={form.control}
                name="kycStatus"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Verificação do profissional">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KYC_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field
            label="Cadastrados nos últimos (dias)"
            htmlFor="c-days"
            error={errors.activeWithinDays?.message}
            hint="Deixe vazio para incluir todos os cadastros."
          >
            <Input id="c-days" inputMode="numeric" placeholder="Ex.: 30" aria-invalid={!!errors.activeWithinDays} {...form.register("activeWithinDays")} />
          </Field>
          <Controller
            control={form.control}
            name="onlyActive"
            render={({ field }) => (
              <SettingRow
                title="Somente usuários ativos"
                description="Exclui contas bloqueadas ou desativadas."
                control={<Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Somente usuários ativos" />}
              />
            )}
          />
        </FormSection>

        <FormSection
          title="Mensagem"
          description={
            <>
              Use <code className="rounded bg-muted px-1">{"{{name}}"}</code> para inserir o nome do usuário.
            </>
          }
        >
          {!isPush && activeTemplates.length > 0 && (
            <Field label="Template de e-mail (opcional)" hint="Preenche assunto e corpo; você ainda pode editar.">
              <Controller
                control={form.control}
                name="emailTemplateId"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(id) => {
                      field.onChange(id);
                      const t = activeTemplates.find((x) => x.id === id);
                      if (t) {
                        form.setValue("title", t.subject, { shouldValidate: true, shouldDirty: true });
                        form.setValue("body", t.bodyHtml, { shouldValidate: true, shouldDirty: true });
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Template de e-mail">
                      <SelectValue placeholder="Escolha um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          <Field label={isPush ? "Título do push" : "Assunto do e-mail"} htmlFor="c-title" required error={errors.title?.message}>
            <Input id="c-title" placeholder="Olá {{name}}!" aria-invalid={!!errors.title} {...form.register("title")} />
          </Field>
          <Field label={isPush ? "Mensagem" : "Corpo (HTML)"} htmlFor="c-body" required error={errors.body?.message}>
            <Textarea
              id="c-body"
              rows={isPush ? 3 : 10}
              placeholder={isPush ? "Sua próxima oportunidade te espera, {{name}}." : "<h1>Olá {{name}}</h1><p>…</p>"}
              aria-invalid={!!errors.body}
              className={cn(!isPush && "font-mono text-xs")}
              {...form.register("body")}
            />
          </Field>
        </FormSection>
      </SectionCard>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <SectionCard title="Público estimado" description={preview.data?.description}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <div className="text-2xl font-extrabold tabular-nums text-navy">
                  {preview.isFetching && !preview.data ? "…" : preview.data ? formatNumber(preview.data.count) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">destinatários alcançáveis</div>
              </div>
            </div>
            {preview.error && <p className="text-xs text-rose-600">{preview.error.message}</p>}
            {preview.data?.count === 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                Nenhum usuário alcançável neste canal ({isPush ? "sem push token" : "sem e-mail"}).
              </p>
            )}
            {preview.data && preview.data.sample.length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Amostra</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {preview.data.sample.map((u) => (
                    <li key={u.id} className="truncate">
                      {u.name ?? "—"}
                      {!isPush && u.email ? ` · ${u.email}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Criar rascunho
            </Button>
            <p className="text-center text-xs text-muted-foreground">Você revisa e envia na próxima tela.</p>
          </div>
        </SectionCard>
      </aside>
    </form>
  );
}
