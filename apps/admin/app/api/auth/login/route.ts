import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverTrpc, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** "Lembrar de mim": persistent cookie (24h, the JWT lifetime) vs session cookie. */
  remember: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  try {
    const { remember, ...credentials } = parsed.data;
    const result = await serverTrpc().admin.login.mutate(credentials);

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(remember ? { maxAge: ADMIN_COOKIE_MAX_AGE } : {}),
    });

    return NextResponse.json({ ok: true, admin: result.admin });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Credenciais inválidas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
