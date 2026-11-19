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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSaveTemplate, type EmailTemplate } from "../api";

const schema = z.object({
  name: z.string().trim().min(2, "Mínimo de 2 caracteres"),
  subject: z.string().trim().min(2, "Mínimo de 2 caracteres"),
  bodyHtml: z.string().trim().min(2, "Mínimo de 2 caracteres"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", subject: "", bodyHtml: "", isActive: true };

/** Create / edit an e-mail template. `template === null` closes; `"new"` creates. */
export function TemplateDialog({ template, onClose }: { template: EmailTemplate | "new" | null; onClose: () => void }) {
  const editing = template && template !== "new" ? template : null;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const save = useSaveTemplate(onClose);
  const { errors, isDirty } = form.formState;

  useEffect(() => {
    if (!template) return;
    form.reset(
      editing ? { name: editing.name, subject: editing.subject, bodyHtml: editing.bodyHtml, isActive: editing.isActive } : EMPTY
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const onSubmit = form.handleSubmit((v) => {
    const data = { name: v.name.trim(), subject: v.subject.trim(), bodyHtml: v.bodyHtml.trim() };
    if (editing) save.update.mutate({ id: editing.id, ...data, isActive: v.isActive });
    else save.create.mutate(data);
  });

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy">{editing ? "Editar template" : "Novo template"}</DialogTitle>
          <DialogDescription>
            Use <code className="rounded bg-muted px-1">{"{{name}}"}</code> para inserir o nome do usuário.
          </DialogDescription>
        </DialogHeader>
        <form id="template-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="t-name" required error={errors.name?.message}>
              <Input id="t-name" aria-invalid={!!errors.name} {...form.register("name")} />
            </Field>
            <Field label="Assunto" htmlFor="t-subject" required error={errors.subject?.message}>
              <Input id="t-subject" aria-invalid={!!errors.subject} {...form.register("subject")} />
            </Field>
          </div>
          <Field label="Corpo (HTML)" htmlFor="t-body" required error={errors.bodyHtml?.message}>
            <Textarea
              id="t-body"
              rows={10}
              className="font-mono text-xs"
              placeholder="<h1>Olá {{name}}</h1>"
              aria-invalid={!!errors.bodyHtml}
              {...form.register("bodyHtml")}
            />
          </Field>
          {editing && (
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <SettingRow
                  title="Template ativo"
                  description="Templates inativos não aparecem ao criar campanhas."
                  control={<Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Template ativo" />}
                />
              )}
            />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="template-form" disabled={save.isPending || (!!editing && !isDirty)}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
