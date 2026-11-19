"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Field } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ADMIN_ROLE_LABEL } from "@/constants/status";
import { ADMIN_ROLES, useCreateAdmin, type RoleInfo } from "../api";

const schema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome (mín. 2 caracteres)").max(80, "Máximo de 80 caracteres"),
    email: z.string().trim().toLowerCase().email("E-mail inválido"),
    role: z.enum(["SUPER_ADMIN", "OPERATOR", "VIEWER"], { required_error: "Escolha um papel" }),
    password: z.string().min(10, "A senha deve ter pelo menos 10 caracteres").max(200, "Senha muito longa"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem" });
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", email: "", role: "OPERATOR", password: "", confirm: "" };

export function NewAdminDialog({ open, onOpenChange, roles }: { open: boolean; onOpenChange: (o: boolean) => void; roles?: RoleInfo[] }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const close = () => {
    form.reset(EMPTY);
    onOpenChange(false);
  };
  const create = useCreateAdmin(close);
  const { errors } = form.formState;
  const role = form.watch("role");
  const roleInfo = roles?.find((r) => r.role === role);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy">Novo administrador</DialogTitle>
          <DialogDescription>A pessoa entra no painel com este e-mail e a senha definida aqui.</DialogDescription>
        </DialogHeader>
        <form
          id="new-admin-form"
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(({ confirm: _c, ...v }) => create.mutate(v))}
        >
          <Field label="Nome" htmlFor="a-name" required error={errors.name?.message}>
            <Input id="a-name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
          <Field label="E-mail" htmlFor="a-email" required error={errors.email?.message}>
            <Input id="a-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register("email")} />
          </Field>
          <Field label="Papel" required error={errors.role?.message} hint={roleInfo?.description}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Papel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roles?.find((x) => x.role === r)?.label ?? ADMIN_ROLE_LABEL[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Senha inicial" htmlFor="a-pass" required error={errors.password?.message} hint="Mínimo de 10 caracteres.">
              <Input id="a-pass" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            </Field>
            <Field label="Confirmar senha" htmlFor="a-confirm" required error={errors.confirm?.message}>
              <Input id="a-confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="new-admin-form" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Criar administrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
