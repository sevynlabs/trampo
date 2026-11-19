/**
 * Status tokens — ONE place that decides how every status looks.
 * Tones map to colours in components/ds/status-badge.tsx.
 */
export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral" | "brand" | "navy";

export type StatusDef = { label: string; tone: StatusTone };

/** Generic statuses (design-system level). */
export const GENERIC_STATUS = {
  active: { label: "Ativo", tone: "success" },
  inactive: { label: "Inativo", tone: "neutral" },
  pending: { label: "Pendente", tone: "warning" },
  verified: { label: "Verificado", tone: "info" },
  in_progress: { label: "Em andamento", tone: "info" },
  completed: { label: "Concluído", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
  paid: { label: "Pago", tone: "success" },
  processing: { label: "Em processamento", tone: "warning" },
  rejected: { label: "Rejeitado", tone: "danger" },
  blocked: { label: "Bloqueado", tone: "danger" },
  scheduled: { label: "Agendado", tone: "info" },
  ended: { label: "Encerrado", tone: "neutral" },
  review: { label: "Em revisão", tone: "warning" },
  hidden: { label: "Oculto", tone: "neutral" },
} as const satisfies Record<string, StatusDef>;

/** Task (Solicitação) lifecycle — mirrors Prisma TaskStatus. */
export const TASK_STATUS: Record<string, StatusDef> = {
  OPEN: { label: "Aguardando", tone: "warning" },
  ACCEPTED: { label: "Aceita", tone: "info" },
  IN_PROGRESS: { label: "Em andamento", tone: "info" },
  COMPLETED: { label: "Concluída", tone: "success" },
  RELEASED: { label: "Finalizada (paga)", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "danger" },
  DISPUTED: { label: "Em disputa", tone: "danger" },
};

/** Payment — mirrors Prisma PaymentStatus. */
export const PAYMENT_STATUS: Record<string, StatusDef> = {
  PENDING: { label: "Pendente", tone: "warning" },
  CONFIRMED: { label: "Pago", tone: "success" },
  HELD: { label: "Em custódia", tone: "info" },
  RELEASED: { label: "Repassado", tone: "success" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  DISPUTED: { label: "Em disputa", tone: "danger" },
  EXPIRED: { label: "Cancelado", tone: "neutral" },
};

export const WITHDRAWAL_STATUS: Record<string, StatusDef> = {
  PENDING: { label: "Em processamento", tone: "warning" },
  PAID: { label: "Pago", tone: "success" },
  FAILED: { label: "Rejeitado", tone: "danger" },
};

/** KYC / verification — mirrors Prisma KycStatus. */
export const KYC_STATUS: Record<string, StatusDef> = {
  PENDING: { label: "Pendente", tone: "neutral" },
  SUBMITTED: { label: "Em análise", tone: "warning" },
  APPROVED: { label: "Verificado", tone: "info" },
  REJECTED: { label: "Rejeitado", tone: "danger" },
};

/** Dispute — mirrors Prisma DisputeStatus. */
export const DISPUTE_STATUS: Record<string, StatusDef> = {
  OPEN: { label: "Aberta", tone: "danger" },
  RESOLVED_RELEASED: { label: "Resolvida · repasse", tone: "success" },
  RESOLVED_REFUNDED: { label: "Resolvida · reembolso", tone: "neutral" },
};

export const CAMPAIGN_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  SCHEDULED: { label: "Agendada", tone: "info" },
  SENDING: { label: "Enviando", tone: "warning" },
  SENT: { label: "Encerrada", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

export const ROLE_LABEL: Record<string, string> = {
  CLIENT: "Cliente",
  TASKER: "Profissional",
  BOTH: "Cliente e profissional",
};

export const ADMIN_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
};

export function statusDef(map: Record<string, StatusDef>, key: string | null | undefined): StatusDef {
  if (!key) return { label: "—", tone: "neutral" };
  return map[key] ?? { label: key, tone: "neutral" };
}
