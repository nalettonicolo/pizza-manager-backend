import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

type PdfAttachment = {
  filename: string
  content: Uint8Array
  contentType: string
}

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
  const html = typeof ctx.row.payload?.html === "string" ? ctx.row.payload.html : undefined

  let attachment: PdfAttachment | null = null
  try {
    attachment = await loadPdfAttachment(ctx)
  } catch (e) {
    return {
      ok: false,
      code: "FAILED",
      message: `email_smtp: allegato PDF: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
    }
  }

  const relay = ctx.env.NOTIFY_EMAIL_RELAY_URL?.trim()
  if (relay) {
    return sendViaRelay(relay, {
      from,
      to,
      subject,
      text,
      html,
      attachment,
      row: ctx.row,
      env: ctx.env,
    })
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

  return sendViaSmtp(host, from, to, subject, text, html, attachment, ctx.env)
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadPdfAttachment(ctx: AdapterSendContext): Promise<PdfAttachment | null> {
  const path = String(ctx.row.payload?.pdf_storage_path || "").trim()
  if (!path) return null
  if (!ctx.admin) {
    throw new Error("client Storage assente")
  }
  const { data, error } = await ctx.admin.storage.from("contratti").download(path)
  if (error || !data) {
    throw new Error(error?.message || "download fallito")
  }
  const filename =
    String(ctx.row.payload?.pdf_filename || "").trim() ||
    path.split("/").pop() ||
    "documento.pdf"
  return {
    filename,
    content: new Uint8Array(await data.arrayBuffer()),
    contentType: "application/pdf",
  }
}

async function sendViaRelay(
  relayUrl: string,
  args: {
    from: string | undefined
    to: string
    subject: string
    text: string
    html?: string
    attachment: PdfAttachment | null
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
        html: args.html,
        tenant_id: args.row.tenant_id,
        notifica_id: args.row.id,
        tipo: args.row.tipo,
        payload: args.row.payload,
        attachments: args.attachment
          ? [
              {
                filename: args.attachment.filename,
                contentType: args.attachment.contentType,
                contentBase64: bytesToBase64(args.attachment.content),
              },
            ]
          : [],
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
  html: string | undefined,
  attachment: PdfAttachment | null,
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
    const message: Record<string, unknown> = {
      from,
      to,
      subject,
      content: text,
    }
    if (html && html.trim()) message.html = html
    if (attachment) {
      message.attachments = [
        {
          filename: attachment.filename,
          content: attachment.content,
          encoding: "binary",
          contentType: attachment.contentType,
        },
      ]
    }
    await client.send(message)
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
