"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { Field, FormSection, InfoCard, SectionCard } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { DEFAULT_PERIOD, PERIODS, isPeriod, type Period } from "@/constants/period";
import { cn } from "@/lib/utils";

/**
 * Browser-only panel preferences (localStorage). Nothing here is sent to the
 * API — each admin/browser keeps its own choices.
 */
export const PANEL_PREFS_KEY = "trampo-admin:panel-prefs";

export type PanelPrefs = { density: "comfortable" | "compact"; defaultPeriod: Period };
const DEFAULT_PREFS: PanelPrefs = { density: "comfortable", defaultPeriod: DEFAULT_PERIOD };

export function readPanelPrefs(): PanelPrefs {
  try {
    const raw = window.localStorage.getItem(PANEL_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<PanelPrefs>;
    return {
      density: p.density === "compact" ? "compact" : "comfortable",
      defaultPeriod: isPeriod(p.defaultPeriod) ? p.defaultPeriod : DEFAULT_PERIOD,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePanelPrefs(p: PanelPrefs): boolean {
  try {
    window.localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

const DENSITY = [
  { value: "comfortable" as const, title: "Confortável", description: "Linhas mais altas, leitura tranquila." },
  { value: "compact" as const, title: "Compacta", description: "Mais linhas por tela." },
];

export function PanelPreferences() {
  const [saved, setSaved] = useState<PanelPrefs>(DEFAULT_PREFS);
  const [prefs, setPrefs] = useState<PanelPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const p = readPanelPrefs();
    setSaved(p);
    setPrefs(p);
  }, []);

  const dirty = prefs.density !== saved.density || prefs.defaultPeriod !== saved.defaultPeriod;

  return (
    <div className="space-y-4">
      <InfoCard icon={Monitor} tone="sky" title="Preferências deste navegador">
        Ficam salvas só neste navegador e não afetam outros administradores nem a plataforma.
      </InfoCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (writePanelPrefs(prefs)) {
            setSaved(prefs);
            toast.success("Preferências salvas neste navegador");
          } else {
            toast.error("Não foi possível salvar", { description: "O navegador bloqueou o armazenamento local." });
          }
        }}
      >
        <SectionCard
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={!dirty} onClick={() => setPrefs(saved)}>
                Descartar
              </Button>
              <Button type="submit" disabled={!dirty}>
                Salvar alterações
              </Button>
            </div>
          }
        >
          <FormSection title="Densidade das tabelas" description="Espaçamento das linhas nas listagens.">
            <RadioGroup
              value={prefs.density}
              onValueChange={(v) => setPrefs({ ...prefs, density: v as PanelPrefs["density"] })}
              className="grid gap-3 sm:grid-cols-2"
              aria-label="Densidade das tabelas"
            >
              {DENSITY.map((d) => (
                <label
                  key={d.value}
                  htmlFor={`density-${d.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:border-navy/25",
                    prefs.density === d.value && "border-primary ring-2 ring-primary/20"
                  )}
                >
                  <RadioGroupItem id={`density-${d.value}`} value={d.value} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold text-navy">{d.title}</span>
                    <span className="block text-xs text-muted-foreground">{d.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </FormSection>
          <FormSection title="Período padrão" description="Período sugerido ao abrir dashboards e relatórios.">
            <Field label="Período">
              <Select value={prefs.defaultPeriod} onValueChange={(v) => setPrefs({ ...prefs, defaultPeriod: v as Period })}>
                <SelectTrigger className="sm:max-w-xs" aria-label="Período padrão">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>
        </SectionCard>
      </form>
    </div>
  );
}
