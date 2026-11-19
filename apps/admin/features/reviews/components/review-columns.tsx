"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { IconButton, RowActions, StarRow, StatusBadge, Tag, UserAvatar, UserCell } from "@/components/ds";
import { formatDate } from "@/lib/format";
import { DIRECTION_LABEL, reviewParties, type ReviewRow } from "../api";

export function buildReviewColumns({
  onView,
  onHide,
  onUnhide,
  readOnlyReason,
}: {
  onView: (r: ReviewRow) => void;
  onHide: (r: ReviewRow) => void;
  onUnhide: (r: ReviewRow) => void;
  /** Set for read-only admins: hide/unhide render disabled with this tooltip. */
  readOnlyReason?: string;
}): ColumnDef<ReviewRow, unknown>[] {
  return [
    {
      id: "review",
      header: "Avaliação",
      meta: { className: "min-w-[280px] max-w-[360px]" },
      cell: ({ row: { original: r } }) => (
        <div className="flex items-start gap-3">
          <UserAvatar name={r.reviewer.name} src={r.reviewer.avatarUrl} size="sm" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-semibold text-navy">{r.reviewer.name || "Sem nome"}</span>
              <Tag tone={r.direction === "CLIENT_TO_PRO" ? "brand" : "info"} className="text-2xs">
                {DIRECTION_LABEL[r.direction]}
              </Tag>
            </div>
            <p className={r.hiddenAt ? "line-clamp-2 text-sm italic text-muted-foreground line-through" : "line-clamp-2 text-sm text-muted-foreground"}>
              {r.comment ? `“${r.comment}”` : <span className="italic">Sem comentário</span>}
            </p>
            {r.hiddenAt && <StatusBadge tone="neutral" label="Oculta" />}
          </div>
        </div>
      ),
    },
    {
      id: "task",
      header: "Serviço",
      meta: { className: "min-w-[180px]" },
      cell: ({ row: { original: r } }) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-navy">{r.task.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.task.categoryName} · {r.task.code}
          </div>
        </div>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row: { original: r } }) => {
        const p = reviewParties(r).client;
        return <UserCell name={p.name} avatarUrl={p.avatarUrl} publicCode={p.publicCode} size="sm" />;
      },
    },
    {
      id: "professional",
      header: "Profissional",
      cell: ({ row: { original: r } }) => {
        const p = reviewParties(r).professional;
        return <UserCell name={p.name} avatarUrl={p.avatarUrl} publicCode={p.publicCode} size="sm" />;
      },
    },
    {
      id: "rating",
      header: "Nota",
      enableSorting: true,
      cell: ({ row: { original: r } }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold tabular-nums text-navy">{r.rating},0</span>
          <StarRow value={r.rating} />
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Data",
      enableSorting: true,
      cell: ({ row: { original: r } }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row: { original: r } }) => (
        <RowActions>
          <IconButton icon={Eye} label="Ver detalhes" onClick={() => onView(r)} />
          {r.hiddenAt ? (
            <IconButton icon={RotateCcw} label="Reexibir avaliação" disabledReason={readOnlyReason} onClick={() => onUnhide(r)} />
          ) : (
            <IconButton
              icon={EyeOff}
              label="Ocultar avaliação"
              tone="danger"
              disabledReason={readOnlyReason}
              onClick={() => onHide(r)}
            />
          )}
        </RowActions>
      ),
    },
  ];
}
