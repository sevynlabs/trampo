"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ds";
import { cn } from "@/lib/utils";
import { useSetUserRole, type UserRole } from "../api";
import { ROLE_OPTIONS } from "./user-badges";

const schema = z.object({ role: z.enum(["CLIENT", "TASKER", "BOTH"], { required_error: "Escolha um tipo de conta" }) });
type FormValues = z.infer<typeof schema>;

export type RoleTarget = { id: string; name: string | null; role: string };

/** "Editar" a user: change the account type (setUserRole). */
export function RoleDialog({ target, onOpenChange }: { target: RoleTarget | null; onOpenChange: (open: boolean) => void }) {
  const mutation = useSetUserRole();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: (target?.role as UserRole) ?? "CLIENT" },
  });

  useEffect(() => {
    if (target) form.reset({ role: target.role as UserRole });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, target?.role]);

  const selected = form.watch("role");
  const unchanged = selected === target?.role;
  const losingPro = target && target.role !== "CLIENT" && selected === "CLIENT";

  const onSubmit = form.handleSubmit((values) => {
    if (!target) return;
    mutation.mutate({ id: target.id, role: values.role }, { onSuccess: () => onOpenChange(false) });
  });

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-navy">Editar usuário</DialogTitle>
            <DialogDescription>
              Altere o tipo de conta de <b className="text-foreground">{target?.name || "Sem nome"}</b>. Nome, telefone e
              e-mail são editados pelo próprio usuário no app.
            </DialogDescription>
          </DialogHeader>

          <Field label="Tipo de conta" error={form.formState.errors.role?.message}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2">
                  {ROLE_OPTIONS.map((o) => (
                    <Label
                      key={o.value}
                      htmlFor={`role-${o.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-navy/25",
                        field.value === o.value && "border-primary bg-brand-soft/40"
                      )}
                    >
                      <RadioGroupItem id={`role-${o.value}`} value={o.value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-semibold text-navy">{o.label}</span>
                        <span className="block text-xs font-normal text-muted-foreground">{o.description}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              )}
            />
          </Field>

          {losingPro && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Como cliente, o usuário deixa de aparecer como profissional. O perfil profissional e o histórico são mantidos.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || unchanged}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
