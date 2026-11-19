"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowRight, BarChart3, CalendarClock, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Star, Users, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ds/form";

const REMEMBER_KEY = "trampo-admin:email";

const schema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
  remember: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: Users, label: "Usuários e profissionais" },
  { icon: CalendarClock, label: "Serviços e solicitações" },
  { icon: Wallet, label: "Pagamentos e saques" },
  { icon: Star, label: "Avaliações e disputas" },
  { icon: BarChart3, label: "Relatórios e métricas" },
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });

  // Prefill the remembered e-mail (never the password)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setValue("email", saved);
        setFocus("password");
      } else setFocus("email");
    } catch {
      setFocus("email");
    }
  }, [setValue, setFocus]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "E-mail ou senha incorretos");
      }
      try {
        if (values.remember) localStorage.setItem(REMEMBER_KEY, values.email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage unavailable: ignore */
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Não foi possível entrar");
    }
  }

  const remember = watch("remember");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <svg className="pointer-events-none absolute -bottom-24 -right-24 h-[520px] w-[520px] opacity-90" viewBox="0 0 520 520" aria-hidden>
          <path d="M40 470 C 200 380, 360 330, 520 300" stroke="#FF6A00" strokeWidth="26" strokeLinecap="round" fill="none" />
          <circle cx="430" cy="120" r="140" fill="#0096D6" opacity="0.08" />
          <circle cx="120" cy="420" r="110" fill="#FF6A00" opacity="0.08" />
        </svg>
        <Logo tone="dark" size={44} />
        <div className="relative max-w-md space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Painel
            <br />
            Administrativo
          </h1>
          <p className="text-lg text-white/75">Gestão completa da plataforma de serviços sob demanda.</p>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Trampo · acesso restrito à equipe</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size={38} />
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-card-hover sm:p-10">
            <h2 className="text-2xl font-extrabold tracking-tight text-navy">Acesse sua conta</h2>
            <p className="mt-1 text-sm text-muted-foreground">Entre no painel administrativo</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
              <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@trampo.com.br"
                    aria-invalid={!!errors.email}
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm transition-colors placeholder:text-muted-foreground hover:border-navy/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 aria-[invalid=true]:border-destructive"
                    {...register("email")}
                  />
                </div>
              </Field>

              <Field label="Senha" htmlFor="password" error={errors.password?.message}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    aria-invalid={!!errors.password}
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-11 text-sm transition-colors placeholder:text-muted-foreground hover:border-navy/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 aria-[invalid=true]:border-destructive"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={remember} onCheckedChange={(v) => setValue("remember", v === true)} aria-label="Lembrar de mim" />
                  Lembrar de mim
                </label>
                <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-semibold text-sky hover:underline">
                  Esqueci minha senha
                </button>
              </div>

              {serverError && (
                <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {serverError}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {isSubmitting ? "Entrando…" : "Entrar no painel"}
                {!isSubmitting && <ArrowRight />}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-navy">Esqueceu a senha?</DialogTitle>
            <DialogDescription>
              Por segurança, a senha do painel é redefinida por um Super Admin em Configurações → Administradores.
              Peça a um responsável da equipe para gerar uma nova senha para o seu e-mail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
