import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@trampo/contracts";

export const metadata: Metadata = {
  title: "Trampo · Serviços sob demanda no Triângulo Mineiro",
  description:
    "Contrate profissionais verificados perto de você em Uberlândia, Uberaba e Araguari — ou ofereça seus serviços e ganhe mais. Pagamento seguro via Pix.",
};

const STEPS = [
  { title: "Publique o que precisa", body: "Conte o serviço, o endereço e o horário. Você vê o valor total antes de confirmar." },
  { title: "Um profissional aceita", body: "Profissionais verificados da sua região recebem o pedido e confirmam." },
  { title: "Pague com segurança", body: "O Pix fica guardado e só é liberado ao profissional depois do serviço concluído." },
];

const BENEFITS = [
  { title: "Profissionais verificados", body: "Documento, selfie e certidão de antecedentes conferidos pela nossa equipe." },
  { title: "Pagamento protegido", body: "Se algo der errado, abra uma disputa: o valor fica retido até a análise." },
  { title: "Perto de você", body: "Uberlândia, Uberaba e Araguari, com profissionais da própria cidade." },
];

const CATEGORIES = ["Reformas e Obras", "Elétrica", "Hidráulica", "Limpeza", "Jardinagem", "Instalação e Montagem", "Pintura", "Ar-condicionado"];

/** Home of the public site (trampooficial.com). */
export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="space-y-5 pt-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Triângulo Mineiro</p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-navy sm:text-5xl">
          Contrate serviços com <span className="text-brand">confiança</span>, perto de você.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-foreground/80">
          O Trampo conecta quem precisa de um serviço a profissionais verificados de Uberlândia, Uberaba e Araguari. Quem trabalha
          por conta própria divulga o seu trabalho e recebe pedidos da região.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <span className="inline-flex items-center rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white">
            Em breve na App Store
          </span>
          <span className="inline-flex items-center rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white">
            Em breve no Google Play
          </span>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-navy">Como funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border bg-card p-5">
              <span className="text-sm font-bold text-brand">Passo {i + 1}</span>
              <h3 className="mt-1 font-bold text-navy">{s.title}</h3>
              <p className="mt-1 text-sm leading-6 text-foreground/80">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="space-y-1">
            <h3 className="font-bold text-navy">{b.title}</h3>
            <p className="text-sm leading-6 text-foreground/80">{b.body}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-navy">Serviços</h2>
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li key={c} className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-navy">
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-navy p-6 text-white sm:p-8">
        <h2 className="text-2xl font-bold">É profissional?</h2>
        <p className="mt-2 max-w-2xl leading-7 text-white/80">
          Cadastre-se no app, envie seus documentos para verificação e comece a receber pedidos da sua cidade. Você recebe por Pix
          depois de cada serviço concluído.
        </p>
      </section>

      <section className="space-y-2 text-sm text-foreground/80">
        <p>
          Dúvidas: <strong className="select-all text-brand">{SUPPORT_EMAIL}</strong> ·{" "}
          <Link href="/suporte" className="font-medium text-navy underline underline-offset-4">
            Central de ajuda
          </Link>
        </p>
      </section>
    </div>
  );
}
