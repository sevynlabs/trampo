"use client";

import { useState } from "react";
import { Check, Copy, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";

/**
 * Explains that accounts are created in the app (phone + OTP) — the admin
 * cannot create them — and offers an invite text to copy and send.
 * Shared by "+ Novo usuário" and "+ Cadastrar profissional".
 */
export function InviteDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  steps,
  inviteText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  steps: string[];
  inviteText: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteText);
      setCopied(true);
      toast.success("Convite copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <DialogTitle className="text-navy">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy">
                {i + 1}
              </span>
              <span className="pt-0.5 text-foreground">{s}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-navy">Texto do convite</div>
          <p className="select-all whitespace-pre-line rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-foreground">
            {inviteText}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiado" : "Copiar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
