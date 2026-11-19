import type { LegalSection } from "@trampo/contracts";
import { LEGAL_LAST_UPDATED } from "@trampo/contracts";

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy">{title}</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {LEGAL_LAST_UPDATED}</p>
      </header>
      {sections.map((s) => (
        <section key={s.title} className="space-y-1.5">
          <h2 className="text-lg font-bold text-navy">{s.title}</h2>
          <p className="leading-7 text-foreground/85">{s.body}</p>
        </section>
      ))}
    </article>
  );
}
