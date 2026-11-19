"use client";

import { ConfirmDialog } from "@/components/ds";
import { useSetUserActive } from "../api";

export type ActiveTarget = { id: string; name: string | null; isActive: boolean };

/**
 * Confirm + run block/unblock for one user. `kind` only changes the wording
 * (professionals are "suspensos/reativados", users "bloqueados/desbloqueados").
 */
export function UserActiveDialog({
  target,
  onOpenChange,
  kind = "user",
  onDone,
}: {
  target: ActiveTarget | null;
  onOpenChange: (open: boolean) => void;
  kind?: "user" | "professional";
  onDone?: () => void;
}) {
  const mutation = useSetUserActive();
  const blocking = !!target?.isActive;
  const who = target?.name || "este usuário";
  const pro = kind === "professional";

  const title = blocking
    ? pro
      ? `Suspender ${who}?`
      : `Bloquear ${who}?`
    : pro
      ? `Reativar ${who}?`
      : `Desbloquear ${who}?`;

  const description = blocking
    ? pro
      ? "O profissional deixa de acessar o app e não recebe novas solicitações até ser reativado."
      : "O usuário perde o acesso ao app até ser desbloqueado. Solicitações em andamento não são canceladas."
    : "O acesso ao app é restabelecido imediatamente.";

  return (
    <ConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      tone={blocking ? "danger" : "default"}
      confirmLabel={blocking ? (pro ? "Suspender" : "Bloquear") : pro ? "Reativar" : "Desbloquear"}
      loading={mutation.isPending}
      onConfirm={() => {
        if (!target) return;
        mutation.mutate(
          { id: target.id, active: !target.isActive },
          {
            onSuccess: () => {
              onOpenChange(false);
              onDone?.();
            },
          }
        );
      }}
    />
  );
}
