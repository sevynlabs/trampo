import type { Metadata } from "next";
import { DELETE_ACCOUNT_STEPS, SUPPORT_EMAIL } from "@trampo/contracts";

export const metadata: Metadata = { title: "Excluir conta · Trampo" };

/** Account deletion instructions (Google Play "delete account URL"). */
export default function DeleteAccountPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy">Excluir sua conta do Trampo</h1>
        <p className="text-foreground/85">A exclusão é feita pelo próprio app e acontece na hora.</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-navy">Pelo app</h2>
        <ol className="list-decimal space-y-1.5 pl-5 leading-7 text-foreground/85">
          {DELETE_ACCOUNT_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-bold text-navy">O que é apagado</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/85">
            <li>Nome, telefone, e-mail e foto</li>
            <li>CPF e documentos de verificação</li>
            <li>Chave Pix e dados de profissional</li>
            <li>Notificações e acesso ao app</li>
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 font-bold text-navy">O que fica guardado</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/85">
            <li>Pedidos e pagamentos, sem o seu nome, pelo prazo da legislação fiscal</li>
            <li>Avaliações feitas, como “Usuário excluído”</li>
          </ul>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold text-navy">Sem acesso ao app?</h2>
        <p className="leading-7 text-foreground/85">
          Escreva para <strong className="select-all text-brand">{SUPPORT_EMAIL}</strong> informando o número de celular cadastrado. Confirmamos que o
          pedido é seu e excluímos a conta em até 15 dias.
        </p>
      </section>
    </article>
  );
}
