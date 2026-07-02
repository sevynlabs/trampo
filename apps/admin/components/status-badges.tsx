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
