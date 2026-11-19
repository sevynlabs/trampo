"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Form pattern: <FormSection> groups related fields (title + description on
 * the left, fields on the right on desktop). <Field> wires label, hint and
 * error (pass react-hook-form's `errors.x?.message`). Validation lives in a
 * zod schema next to the form (see features/*).
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-6 border-b border-border/70 py-6 first:pt-0 last:border-0 last:pb-0 md:grid-cols-[240px_1fr]", className)}>
      <div>
        <h3 className="text-sm font-bold text-navy">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-navy">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </Label>
      {children}
      {error ? (
        <p id={hintId} role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Toggle row for settings (label + description + control on the right). */
export function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border border-border/70 p-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-navy">{title}</div>
        {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
