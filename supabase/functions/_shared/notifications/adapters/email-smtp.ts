import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * Email via SMTP (tenant o piattaforma) oppure relay HTTP interno.
 *
 * Env:
 * - NOTIFY_EMAIL_RELAY_URL (preferito: Nest/internal POST JSON)
 * - NOTIFY_SMTP_HOST, NOTIFY_SMTP_PORT, NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS
 * - NOTIFY_FROM_EMAIL
 */
export async function sendEmailSmtp(ctx: AdapterSendContext): Promise<AdapterSendResult> {
  const from = ctx.env.NOTIFY_FROM_EMAIL
  const to = String(ctx.row.destinatario || "").trim()
  if (!to) {
    return { ok: false, code: "FAILED", message: "email_smtp: destinatario mancante" }
  }

  const subject = String(
    (ctx.row.payload?.subject as string) ||
      (ctx.row.payload?.oggetto as string) ||
      `Notifica ${ctx.row.tipo || "ordine"}`,
  ).slice(0, 200)
  const text = buildEmailBody(ctx)

  const relay = ctx.env.NOTIFY_EMAIL_RELAY_URL?.trim()
  if (relay) {
    return sendViaRelay(relay, { from, to, subject, text, row: ctx.row, env: ctx.env })
  }

  const host = ctx.env.NOTIFY_SMTP_HOST?.trim()
  if (!host || !from) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "email_smtp: impostare NOTIFY_EMAIL_RELAY_URL oppure NOTIFY_SMTP_HOST + NOTIFY_FROM_EMAIL",
    }
  }

  return sendViaSmtp(host, from, to, subject, text, ctx.env)
}

function buildEmailBody(ctx: AdapterSendContext): string {
  const p = ctx.row.payload || {}
  if (typeof p.body === "string" && p.body.trim()) return p.body
  if (typeof p.testo === "string" && p.testo.trim()) return p.testo
  if (typeof p.html === "string" && p.html.trim()) {
    return p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }
  try {
    return JSON.stringify(p, null, 2)
  } catch {
    return `Notifica ${ctx.row.tipo || ""} (${ctx.row.id})`
  }
}

async function sendViaRelay(
  relayUrl: string,
  args: {
    from: string | undefined
    to: string
    subject: string
    text: string
    row: AdapterSendContext["row"]
    env: AdapterSendContext["env"]
  },
): Promise<AdapterSendResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    const relayKey = args.env.NOTIFY_EMAIL_RELAY_KEY?.trim()
    if (relayKey) headers.Authorization = `Bearer ${relayKey}`

    const res = await fetch(relayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: args.from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        tenant_id: args.row.tenant_id,
        notifica_id: args.row.id,
        tipo: args.row.tipo,
        payload: args.row.payload,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return {
        ok: false,
        code: "FAILED",
        message: `email_relay HTTP ${res.status}: ${body.slice(0, 200)}`,
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      code: "FAILED",
      message: `email_relay: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

async function sendViaSmtp(
  host: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  env: AdapterSendContext["env"],
): Promise<AdapterSendResult> {
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts")
    const port = Number(env.NOTIFY_SMTP_PORT) || 587
    const user = env.NOTIFY_SMTP_USER?.trim()
    const pass = env.NOTIFY_SMTP_PASS ?? ""
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: user ? { username: user, password: pass } : undefined,
      },
    })
    await client.send({
      from,
      to,
      subject,
      content: text,
    })
    await client.close()
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      code: "FAILED",
      message: `email_smtp: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
    }
  }
}
