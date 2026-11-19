"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Bell, ChevronRight, Mail } from "lucide-react";
import { RowActions, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_STATUS } from "@/constants/status";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHANNEL_LABEL, type CampaignChannel, type CampaignRow } from "../api";

export function ChannelLabel({ channel, className }: { channel: CampaignChannel; className?: string }) {
  const Icon = channel === "PUSH" ? Bell : Mail;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-navy", className)}>
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg", channel === "PUSH" ? "bg-brand-soft text-brand" : "bg-sky-soft text-sky")}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

export function buildCampaignColumns({ onOpen }: { onOpen: (c: CampaignRow) => void }): ColumnDef<CampaignRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: "Campanha",
      enableSorting: true,
      cell: ({ row: { original: c } }) => <span className="font-semibold text-navy">{c.name}</span>,
    },
    {
      id: "channel",
      header: "Canal",
      cell: ({ row: { original: c } }) => <ChannelLabel channel={c.channel} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row: { original: c } }) => <StatusBadge map={CAMPAIGN_STATUS} status={c.status} />,
    },
    {
      id: "audience",
      accessorKey: "recipientCount",
      header: "Público",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ row: { original: c } }) =>
        c.status === "DRAFT" ? (
          <span className="text-xs text-muted-foreground">Definido no envio</span>
        ) : (
          <span className="tabular-nums">{formatNumber(c.recipientCount)} destinatários</span>
        ),
    },
    {
      id: "delivery",
      header: "Entregas",
      meta: { align: "right" },
      cell: ({ row: { original: c } }) =>
        c.recipientCount > 0 ? (
          <div className="text-right tabular-nums">
            <div className="font-semibold text-navy">
              {formatNumber(c.sentCount)}/{formatNumber(c.recipientCount)}
            </div>
            {c.failedCount > 0 && <div className="text-xs text-rose-600">{formatNumber(c.failedCount)} falhas</div>}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Criada em",
      enableSorting: true,
      cell: ({ row: { original: c } }) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(c.createdAt)}</span>,
    },
    {
      id: "sentAt",
      accessorKey: "sentAt",
      header: "Enviada em",
      enableSorting: true,
      cell: ({ row: { original: c } }) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(c.sentAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      meta: { align: "right" },
      cell: ({ row: { original: c } }) => (
        <RowActions>
          <Button variant="ghost" size="xs" onClick={() => onOpen(c)}>
            {c.status === "DRAFT" ? "Revisar e enviar" : "Ver"} <ChevronRight />
          </Button>
        </RowActions>
      ),
    },
  ];
}
