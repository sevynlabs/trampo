import { env } from '../lib/env';

/**
 * Email sender with an automatic dev fallback.
 *
 * When `RESEND_API_KEY` is set we send through Resend's HTTP API. Otherwise we
 * run in "dev" mode: emails are logged to the console instead of being sent,
 * so the whole campaign system is exercisable end-to-end without a provider.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = env.RESEND_FROM || 'TRAMPO <no-reply@trampo.app>';

export const emailMode: 'resend' | 'dev' = env.RESEND_API_KEY ? 'resend' : 'dev';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (emailMode === 'dev') {
    console.log(
      `[EMAIL:dev] -> ${input.to} | ${input.subject} (${input.html.length} chars, not sent)`
    );
    return { ok: true, id: 'dev-' + Date.now() };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Render `{{var}}` placeholders in a template body against a values map. */
export function renderTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}
