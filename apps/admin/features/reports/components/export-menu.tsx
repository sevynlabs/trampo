"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { periodLabel, type Period } from "@/constants/period";
import { EXPORT_KINDS, useExportCsv } from "../api";

/** "Exportar" dropdown → CSV of payments / requests / users for the period. */
export function ExportMenu({ period }: { period: Period }) {
  const { exportCsv, pending } = useExportCsv(period);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!!pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Download />}
          Exportar
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">CSV · {periodLabel(period)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXPORT_KINDS.map((k) => (
          <DropdownMenuItem key={k.kind} onSelect={() => exportCsv(k.kind)} disabled={!!pending} className="flex-col items-start gap-0">
            <span className="font-semibold text-navy">{k.label}</span>
            <span className="text-xs text-muted-foreground">{k.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
