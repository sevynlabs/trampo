"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Percent, Wallet } from "lucide-react";
import { Field } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCreateCoupon, type CouponCreateInput } from "../api";

/**
 * Mirrors `admin.marketing.createCoupon`: code 3–32 (uppercased), kind
 * PERCENT (1–100) | FIXED (centavos ≥ 1), optional maxUses ≥ 1 and validUntil.
 * Number fields are typed as text and parsed here (pt-BR decimal comma).
 */
const schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Mínimo de 3 caracteres")
      .max(32, "Máximo de 32 caracteres")
      .regex(/^[A-Za-z0-9_-]+$/, "Use letras, números, - ou _ (sem espaços)"),
    kind: z.enum(["PERCENT", "FIXED"], { required_error: "Escolha o tipo" }),
    value: z.string().trim().min(1, "Informe o valor"),
    maxUses: z.string().trim(),
    validUntil: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const n = parseDecimal(v.value);
    if (n === null) ctx.addIssue({ code: "custom", path: ["value"], message: "Informe um número" });
    else if (v.kind === "PERCENT" && (!Number.isInteger(n) || n < 1 || n > 100))
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percentual inteiro entre 1 e 100" });
    else if (v.kind === "FIXED" && Math.round(n * 100) < 1)
      ctx.addIssue({ code: "custom", path: ["value"], message: "Valor mínimo de R$ 0,01" });
    if (v.maxUses && !/^\d+$/.test(v.maxUses)) ctx.addIssue({ code: "custom", path: ["maxUses"], message: "Número inteiro" });
    else if (v.maxUses && Number(v.maxUses) < 1) ctx.addIssue({ code: "custom", path: ["maxUses"], message: "Mínimo de 1 uso" });
    if (v.validUntil && endOfDay(v.validUntil) < Date.now())
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "A validade deve ser hoje ou depois" });
  });
type Values = z.infer<typeof schema>;

const EMPTY: Values = { code: "", kind: "PERCENT", value: "", maxUses: "", validUntil: "" };

function parseDecimal(s: string): number | null {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return s && Number.isFinite(n) ? n : null;
}

/** yyyy-mm-dd (local) → last millisecond of that day. */
function endOfDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function toInput(v: Values): CouponCreateInput {
  const n = parseDecimal(v.value) ?? 0;
  return {
    code: v.code.trim().toUpperCase(),
    kind: v.kind,
    value: v.kind === "PERCENT" ? Math.round(n) : Math.round(n * 100),
    maxUses: v.maxUses ? Number(v.maxUses) : undefined,
    validUntil: v.validUntil ? new Date(endOfDay(v.validUntil)).toISOString() : undefined,
  };
}

const KINDS = [
  { value: "PERCENT" as const, icon: Percent, title: "Percentual", description: "Desconto em % do valor do serviço." },
  { value: "FIXED" as const, icon: Wallet, title: "Valor fixo", description: "Desconto em reais (R$)." },
];

/** "+ Novo cupom" dialog. */
export function CouponDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const create = useCreateCoupon(() => onOpenChange(false));
  const { errors } = form.formState;
  const kind = form.watch("kind");

  useEffect(() => {
    if (open) form.reset(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit((v) => create.mutate(toInput(v)));

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy">Novo cupom</DialogTitle>
          <DialogDescription>
            O código é o que o usuário digita no app. A aplicação do desconto no checkout segue as regras de preço da plataforma.
          </DialogDescription>
        </DialogHeader>
        <form id="coupon-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Código" htmlFor="c-code" required error={errors.code?.message} hint="Ex.: BEMVINDO10 — salvo em maiúsculas.">
            <Input
              id="c-code"
              autoComplete="off"
              className="font-mono uppercase"
              aria-invalid={!!errors.code}
              {...form.register("code")}
            />
          </Field>

          <Field label="Tipo" required error={errors.kind?.message}>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    if (form.formState.isSubmitted) void form.trigger("value");
                  }}
                  aria-label="Tipo de desconto"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {KINDS.map((k) => (
                    <label
                      key={k.value}
                      htmlFor={`c-kind-${k.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-navy/25",
                        field.value === k.value && "border-primary ring-2 ring-primary/20"
                      )}
                    >
                      <RadioGroupItem id={`c-kind-${k.value}`} value={k.value} className="mt-0.5" />
                      <k.icon className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-navy">{k.title}</span>
                        <span className="block text-xs text-muted-foreground">{k.description}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={kind === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}
              htmlFor="c-value"
              required
              error={errors.value?.message}
            >
              <div className="relative">
                {kind === "FIXED" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                )}
                <Input
                  id="c-value"
                  inputMode="decimal"
                  placeholder={kind === "PERCENT" ? "10" : "15,00"}
                  className={cn("tabular-nums", kind === "FIXED" ? "pl-10" : "pr-9")}
                  aria-invalid={!!errors.value}
                  {...form.register("value")}
                />
                {kind === "PERCENT" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                )}
              </div>
            </Field>
            <Field label="Limite de usos" htmlFor="c-max" error={errors.maxUses?.message} hint="Vazio = ilimitado.">
              <Input
                id="c-max"
                inputMode="numeric"
                placeholder="Ilimitado"
                className="tabular-nums"
                aria-invalid={!!errors.maxUses}
                {...form.register("maxUses")}
              />
            </Field>
          </div>

          <Field label="Válido até" htmlFor="c-until" error={errors.validUntil?.message} hint="Inclui o dia escolhido. Vazio = sem prazo.">
            <Input id="c-until" type="date" className="sm:max-w-[220px]" aria-invalid={!!errors.validUntil} {...form.register("validUntil")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="coupon-form" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Criar cupom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
