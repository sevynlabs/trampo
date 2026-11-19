"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, Ban, Eye, Pencil, ShieldCheck } from "lucide-react";
import { IconButton, RatingStars, RowActions, StatusBadge, Tag, UserCell } from "@/components/ds";
import type { StatusTone } from "@/constants/status";
import { formatBRL, formatNumber } from "@/lib/format";
import type { ProfessionalRow } from "../api";

/** Verificado / Ativo / Pendente / Rejeitado / Suspenso from KYC + isActive. */
export function professionalStatus(p: { kycStatus: string; isActive: boolean }): { label: string; tone: StatusTone; hint?: string } {
  if (!p.isActive) return { label: "Suspenso", tone: "danger" };
  switch (p.kycStatus) {
    case "APPROVED":
      return { label: "Verificado", tone: "info" };
    case "SUBMITTED":
      return { label: "Pendente", tone: "warning", hint: "verificação em análise" };
    case "REJECTED":
      return { label: "Rejeitado", tone: "danger", hint: "verificação recusada" };
    default:
      return { label: "Ativo", tone: "success", hint: "sem verificação" };
  }
}

export function ProfessionalStatusBadge({ kycStatus, isActive }: { kycStatus: string; isActive: boolean }) {
  const s = professionalStatus({ kycStatus, isActive });
  return (
    <div className="flex flex-col items-start gap-0.5">
      <StatusBadge tone={s.tone} label={s.label} />
      {s.hint && <span className="text-2xs text-muted-foreground">{s.hint}</span>}
    </div>
  );
}

export function CategoryTags({ categories, max = 2 }: { categories: string[]; max?: number }) {
  if (categories.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const rest = categories.length - max;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {categories.slice(0, max).map((c) => (
        <Tag key={c}>{c}</Tag>
      ))}
      {rest > 0 && (
        <Tag tone="neutral">
          <span title={categories.slice(max).join(", ")}>+{rest}</span>
        </Tag>
      )}
    </div>
  );
}

export type ProfessionalRowHandlers = {
  onView: (row: ProfessionalRow) => void;
  onEdit: (row: ProfessionalRow) => void;
  onToggleActive: (row: ProfessionalRow) => void;
  /** taskerProfile id when the row awaits KYC review (link to /kyc/[id]). */
  reviewProfileId: (row: ProfessionalRow) => string | undefined;
  onReview: (profileId: string) => void;
  /** Set for read-only admins: mutating actions render disabled with this tooltip. */
  readOnlyReason?: string;
};

/** Sortable columns (server): `name`, `rating`, `totalTasks` (column id = sortBy). */

export function professionalColumns(h: ProfessionalRowHandlers): ColumnDef<ProfessionalRow, unknown>[] {
  return [
    {
      id: "name",
      header: "Profissional",
      enableSorting: true,
      cell: ({ row }) => <UserCell name={row.original.name} avatarUrl={row.original.avatarUrl} publicCode={row.original.publicCode} subtitle={row.original.location ? `${row.original.location} · ${row.original.phone}` : row.original.phone} />,
      meta: { className: "min-w-[220px]" },
    },
    {
      id: "categories",
      header: "Serviços",
      cell: ({ row }) => <CategoryTags categories={row.original.categories} />,
      meta: { className: "min-w-[180px]" },
    },
    {
      id: "rating",
      header: "Avaliação",
      enableSorting: true,
      cell: ({ row }) => <RatingStars value={row.original.rating} count={row.original.reviewCount} />,
    },
    {
      id: "totalTasks",
      header: "Trampos",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums text-navy">{formatNumber(row.original.totalTasks)}</div>
          <div className="text-2xs text-muted-foreground tabular-nums">{formatBRL(row.original.totalEarnings)}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <ProfessionalStatusBadge kycStatus={row.original.kycStatus} isActive={row.original.isActive} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row }) => {
        const p = row.original;
        const reviewId = p.kycStatus === "SUBMITTED" ? h.reviewProfileId(p) : undefined;
        return (
          <RowActions>
            <IconButton icon={Eye} label="Ver perfil" onClick={() => h.onView(p)} />
            <IconButton icon={Pencil} label="Editar" disabledReason={h.readOnlyReason} onClick={() => h.onEdit(p)} />
            {p.kycStatus === "SUBMITTED" &&
              (reviewId ? (
                <IconButton
                  icon={BadgeCheck}
                  label="Aprovar · analisar verificação"
                  className="text-sky hover:bg-sky-soft hover:text-sky"
                  onClick={() => h.onReview(reviewId)}
                />
              ) : (
                <IconButton icon={BadgeCheck} label="Analisar verificação" disabled />
              ))}
            {p.isActive ? (
              <IconButton
                icon={Ban}
                label="Suspender"
                tone="danger"
                disabledReason={h.readOnlyReason}
                onClick={() => h.onToggleActive(p)}
              />
            ) : (
              <IconButton
                icon={ShieldCheck}
                label="Reativar"
                disabledReason={h.readOnlyReason}
                onClick={() => h.onToggleActive(p)}
              />
            )}
          </RowActions>
        );
      },
    },
  ];
}
