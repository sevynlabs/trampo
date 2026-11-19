"use client";

import { forwardRef, useState } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Icon-only button with tooltip + accessible label (table row actions).
 * `disabledReason` disables it and shows the reason in the tooltip instead
 * (e.g. READ_ONLY_HINT for VIEWER admins).
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "children"> & {
    icon: LucideIcon;
    label: string;
    tone?: "default" | "danger";
    disabledReason?: string;
  }
>(function IconButton({ icon: Icon, label, tone = "default", className, disabledReason, disabled, ...props }, ref) {
  const button = (
    <Button
      ref={ref}
      variant="ghost"
      size="icon-sm"
      aria-label={disabledReason ? `${label} — ${disabledReason}` : label}
      className={tone === "danger" ? `text-rose-600 hover:bg-rose-50 hover:text-rose-700 ${className ?? ""}` : className}
      disabled={disabled || !!disabledReason}
      {...props}
    >
      <Icon />
    </Button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons don't fire pointer events: a focusable wrapper keeps the tooltip working. */}
        {disabledReason ? (
          <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent>{disabledReason ?? label}</TooltipContent>
    </Tooltip>
  );
});

/**
 * Wraps a (disabled) control with a tooltip explaining why — use with
 * `disabled={!!hint}`. Without `hint` it renders the child untouched.
 */
export function DisabledHint({ hint, children, className }: { hint?: string; children: React.ReactNode; className?: string }) {
  if (!hint) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={className ?? "inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Confirmation modal for irreversible / sensitive actions.
 * With `requireReason`, collects a justification (min 3 chars) passed to onConfirm.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "default",
  requireReason,
  reasonLabel = "Motivo",
  reasonPlaceholder,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "default" | "danger";
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  loading?: boolean;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const invalid = requireReason && reason.trim().length < 3;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {requireReason && (
          <div className="space-y-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea
              id="confirm-reason"
              rows={3}
              value={reason}
              placeholder={reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            disabled={loading || invalid}
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
          >
            {loading && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
