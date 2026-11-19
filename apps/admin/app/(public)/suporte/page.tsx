import type { Metadata } from "next";
import { HELP_FAQ, SUPPORT_EMAIL } from "@trampo/contracts";

export const metadata: Metadata = { title: "Suporte · Trampo" };

export default function SupportPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy">Suporte</h1>
        <p className="text-foreground/85">
          Fale com a gente pelo e-mail <strong className="select-all text-brand">{SUPPORT_EMAIL}</strong>. Respondemos em até 1 dia útil.
        </p>
      </header>
      <section className="space-y-5">
        <h2 className="text-xl font-bold text-navy">Perguntas frequentes</h2>
        {HELP_FAQ.map((f) => (
          <div key={f.q} className="space-y-1">
            <h3 className="font-semibold text-navy">{f.q}</h3>
            <p className="leading-7 text-foreground/85">{f.a}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
