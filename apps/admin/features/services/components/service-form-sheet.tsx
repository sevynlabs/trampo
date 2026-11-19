"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Field, SettingRow } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateService, useUpdateService, type ServiceRow } from "../api";
import { ServiceIcon } from "./service-icon";

/** Mirrors the API slugify (services.ts) for the live preview. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const schema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres").max(80, "Máximo de 80 caracteres"),
  slug: z
    .string()
    .trim()
    .max(60, "Máximo de 60 caracteres")
    .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Use apenas letras minúsculas, números e hífens")
    .refine((v) => v === "" || v.length >= 2, "Informe ao menos 2 caracteres"),
  icon: z
    .string()
    .trim()
    .max(60, "Máximo de 60 caracteres")
    .refine((v) => v === "" || /^[a-z0-9-]+$/.test(v), "Use o nome do ícone, ex.: flash-outline"),
  description: z.string().trim().max(500, "Máximo de 500 caracteres"),
  sortOrder: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 9999), "Número inteiro entre 0 e 9999"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toDefaults(s?: ServiceRow | null): FormValues {
  return {
    name: s?.name ?? "",
    slug: s?.slug ?? "",
    icon: s?.icon ?? "",
    description: s?.description ?? "",
    sortOrder: s ? String(s.sortOrder) : "",
    isActive: s?.isActive ?? true,
  };
}

/** Create / edit form for a service category, in a side drawer. */
export function ServiceFormSheet({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null/undefined = creating */
  service?: ServiceRow | null;
}) {
  const editing = !!service;
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(service) });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(toDefaults(service));
  }, [open, service, reset]);

  const close = () => onOpenChange(false);
  const create = useCreateService({ onSuccess: close });
  const update = useUpdateService({ onSuccess: close });
  const saving = create.isPending || update.isPending;

  const name = watch("name");
  const icon = watch("icon");
  const slugPreview = slugify(name || "") || "gerado-automaticamente";

  const onSubmit = (v: FormValues) => {
    const payload = {
      name: v.name,
      icon: v.icon || null,
      description: v.description || null,
      isActive: v.isActive,
      ...(v.slug ? { slug: v.slug } : {}),
      ...(v.sortOrder !== "" ? { sortOrder: Number(v.sortOrder) } : {}),
    };
    if (service) update.mutate({ id: service.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <SheetContent aria-describedby="service-form-desc">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{editing ? "Editar serviço" : "Novo serviço"}</SheetTitle>
            <SheetDescription id="service-form-desc">
              {editing
                ? "Altere os dados da categoria. As mudanças aparecem no app imediatamente."
                : "Crie uma categoria de serviço que os profissionais poderão oferecer."}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
              <ServiceIcon icon={icon} name={name || "?"} />
              <div className="min-w-0">
                <div className="truncate font-semibold text-navy">{name || "Nome do serviço"}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">/{watch("slug") || slugPreview}</div>
              </div>
            </div>

            <Field label="Nome" htmlFor="svc-name" required error={errors.name?.message}>
              <Input id="svc-name" placeholder="Ex.: Elétrica" aria-invalid={!!errors.name} autoFocus {...register("name")} />
            </Field>

            <Field
              label="Slug"
              htmlFor="svc-slug"
              error={errors.slug?.message}
              hint={editing ? "Identificador usado em URLs e no app." : `Deixe em branco para gerar: ${slugPreview}`}
            >
              <Input id="svc-slug" placeholder={slugPreview} aria-invalid={!!errors.slug} {...register("slug")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field
                label="Ícone"
                htmlFor="svc-icon"
                error={errors.icon?.message}
                hint={
                  <>
                    Nome do Ionicons usado no app, ex.: <code className="font-mono">flash-outline</code>,{" "}
                    <code className="font-mono">water-outline</code>, <code className="font-mono">brush-outline</code>.
                  </>
                }
              >
                <Input id="svc-icon" placeholder="flash-outline" aria-invalid={!!errors.icon} {...register("icon")} />
              </Field>
              <Field label="Ordem" htmlFor="svc-order" error={errors.sortOrder?.message} hint="Posição na lista do app.">
                <Input
                  id="svc-order"
                  inputMode="numeric"
                  placeholder={editing ? undefined : "Automática"}
                  aria-invalid={!!errors.sortOrder}
                  {...register("sortOrder")}
                />
              </Field>
            </div>

            <Field label="Descrição" htmlFor="svc-desc" error={errors.description?.message} hint="Até 500 caracteres.">
              <Textarea
                id="svc-desc"
                rows={4}
                placeholder="Instalações, reparos e manutenção elétrica residencial."
                aria-invalid={!!errors.description}
                {...register("description")}
              />
            </Field>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <SettingRow
                  title="Serviço ativo"
                  description="Serviços inativos não aparecem para clientes nem profissionais no app."
                  control={<Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Serviço ativo" />}
                />
              )}
            />
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Salvar alterações" : "Criar serviço"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
