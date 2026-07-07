import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  CLIENT: "Cliente",
  TASKER: "Profissional",
  BOTH: "Ambos",
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge variant="outline">{ROLE_LABELS[role] ?? role}</Badge>;
}

export function UserStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="success">Ativo</Badge>
  ) : (
    <Badge variant="destructive">Bloqueado</Badge>
  );
}

const KYC_MAP: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  PENDING: { label: "Pendente", variant: "secondary" },
  SUBMITTED: { label: "Em análise", variant: "warning" },
  APPROVED: { label: "Aprovado", variant: "success" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
};

export function KycBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cfg = KYC_MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const PAYMENT_MAP: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  PENDING: { label: "Aguardando", variant: "secondary" },
  CONFIRMED: { label: "Pago", variant: "success" },
  HELD: { label: "Em custódia", variant: "warning" },
  RELEASED: { label: "Liberado", variant: "success" },
  REFUNDED: { label: "Reembolsado", variant: "destructive" },
  DISPUTED: { label: "Em disputa", variant: "destructive" },
  EXPIRED: { label: "Expirado", variant: "secondary" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = PAYMENT_MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const WITHDRAWAL_MAP: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  PENDING: { label: "Pendente", variant: "warning" },
  PAID: { label: "Pago", variant: "success" },
  FAILED: { label: "Rejeitado", variant: "destructive" },
};

export function WithdrawalStatusBadge({ status }: { status: string }) {
  const cfg = WITHDRAWAL_MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
