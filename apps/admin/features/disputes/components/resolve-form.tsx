"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Gavel, Undo2, Wallet } from "lucide-react";
import { ConfirmDialog, DisabledHint, Field } from "@/components/ds";
import { useAdminRole } from "@/hooks/use-admin-role";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { useResolveDispute, type DisputeDetail } from "../api";

const schema = z.object({
  outcome: z.enum(["RELEASE", "REFUND"], { required_error: "Escolha uma decisão" }),
  notes: z
    .string()
    .trim()
    .min(5, "Descreva a decisão (mín. 5 caracteres)")
    .max(1000, "Máximo de 1.000 caracteres"),
});
type Values = z.infer<typeof schema>;

const OPTIONS = [
  {
    value: "RELEASE" as const,
    icon: Wallet,
    title: "Liberar ao profissional",
    description: "O pagamento retido é repassado ao profissional e a solicitação é finalizada.",
  },
  {
    value: "REFUND" as const,
    icon: Undo2,
    title: "Reembolsar o cliente",
    description: "O valor pago é devolvido ao cliente e o profissional não recebe.",
  },
];

/** Administrative decision for an OPEN dispute (RELEASE vs REFUND + notes). */
export function ResolveDisputeForm({ dispute }: { dispute: DisputeDetail }) {
  const [confirming, setConfirming] = useState<Values | null>(null);
  const { canEdit, readOnlyReason } = useAdminRole();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { notes: "" } });
  const resolve = useResolveDispute(() => {
    setConfirming(null);
    form.reset({ notes: "" });
  });
  const errors = form.formState.errors;
  const party =
    confirming?.outcome === "RELEASE" ? (dispute.tasker?.name ?? "o profissional") : (dispute.client.name ?? "o cliente");

  return (
    <>
    <form
      onSubmit={form.handleSubmit((v) => canEdit && setConfirming(v))}
      className="space-y-4 rounded-2xl border border-brand/30 bg-brand-soft/30 p-4"
      noValidate
    >
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-brand" aria-hidden />
        <h3 className="text-sm font-bold text-navy">Decisão administrativa</h3>
      </div>

      <Field label="Resultado" required error={errors.outcome?.message}>
        <Controller
          control={form.control}
          name="outcome"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} disabled={!canEdit} aria-label="Resultado da disputa" className="gap-2">
              {OPTIONS.map((o) => (
                <label
                  key={o.value}
                  htmlFor={`outcome-${o.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-navy/25",
                    field.value === o.value && "border-primary ring-2 ring-primary/20"
                  )}
                >
                  <RadioGroupItem id={`outcome-${o.value}`} value={o.value} className="mt-0.5" />
                  <o.icon className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy">
                      {o.title} <span className="font-mono text-2xs text-muted-foreground">({o.value})</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{o.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </Field>

      <Field
        label="Justificativa"
        htmlFor="resolve-notes"
        required
        error={errors.notes?.message}
        hint="Fica registrada na disputa e na auditoria."
      >
        <Textarea
          id="resolve-notes"
          rows={4}
          placeholder="Descreva as evidências analisadas e o motivo da decisão…"
          aria-invalid={!!errors.notes}
          disabled={!canEdit}
          {...form.register("notes")}
        />
      </Field>

      <div className="flex justify-end">
        <DisabledHint hint={readOnlyReason}>
          <Button type="submit" disabled={resolve.isPending || !canEdit}>
            <Gavel /> Registrar decisão
          </Button>
        </DisabledHint>
      </div>
    </form>

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={confirming?.outcome === "RELEASE" ? "Liberar pagamento ao profissional?" : "Reembolsar o cliente?"}
        description={
          <>
            {formatBRL(dispute.amount)} serão {confirming?.outcome === "RELEASE" ? "repassados a" : "devolvidos a"}{" "}
            <b>{party}</b> e a disputa {dispute.code} será encerrada. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel={confirming?.outcome === "RELEASE" ? "Liberar pagamento" : "Reembolsar cliente"}
        tone={confirming?.outcome === "REFUND" ? "danger" : "default"}
        loading={resolve.isPending}
        onConfirm={() => confirming && resolve.mutate({ id: dispute.id, outcome: confirming.outcome, notes: confirming.notes })}
      />
    </>
  );
}
