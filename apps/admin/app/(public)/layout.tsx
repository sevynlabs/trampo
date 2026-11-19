import Link from "next/link";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/suporte", label: "Suporte" },
  { href: "/excluir-conta", label: "Excluir conta" },
];

/** Public pages linked from the App Store / Google Play listings (no login). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" aria-label="Trampo — início">
            <Logo size={30} />
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-muted-foreground">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-muted-foreground">
        Trampo · Serviços sob demanda no Triângulo Mineiro
      </footer>
    </div>
  );
}
