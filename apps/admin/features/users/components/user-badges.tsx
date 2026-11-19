import { StatusBadge, Tag } from "@/components/ds";
import { KYC_STATUS } from "@/constants/status";

const ROLE_TAG: Record<string, { label: string; tone: "navy" | "brand" | "info" }> = {
  CLIENT: { label: "Cliente", tone: "navy" },
  TASKER: { label: "Profissional", tone: "brand" },
  BOTH: { label: "Ambos", tone: "info" },
};

export const ROLE_OPTIONS = [
  { value: "CLIENT", label: "Cliente", description: "Contrata serviços pelo app." },
  { value: "TASKER", label: "Profissional", description: "Oferece serviços e recebe pagamentos." },
  { value: "BOTH", label: "Cliente e profissional", description: "Usa o app dos dois lados." },
] as const;

/** Account type tag: Cliente / Profissional / Ambos. */
export function RoleTag({ role }: { role: string }) {
  const def = ROLE_TAG[role] ?? { label: role, tone: "navy" as const };
  return <Tag tone={def.tone}>{def.label}</Tag>;
}

/** Ativo / Bloqueado pill. */
export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <StatusBadge tone="success" label="Ativo" /> : <StatusBadge tone="danger" label="Bloqueado" />;
}

/** Professional verification pill (KYC); renders nothing for non-professionals. */
export function KycBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return <StatusBadge map={KYC_STATUS} status={status} />;
}
