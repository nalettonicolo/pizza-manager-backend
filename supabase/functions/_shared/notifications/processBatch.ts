import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.49.2"
import { getNotificationAdapter, resolveNotificationChannel } from "./registry.ts"
import type { NotificaOutboxRow } from "./types.ts"

function envMap(): Record<string, string | undefined> {
  return {
    NOTIFY_EMAIL_RELAY_URL: Deno.env.get("NOTIFY_EMAIL_RELAY_URL") ?? undefined,
    NOTIFY_EMAIL_RELAY_KEY: Deno.env.get("NOTIFY_EMAIL_RELAY_KEY") ?? undefined,
    NOTIFY_SMTP_HOST: Deno.env.get("NOTIFY_SMTP_HOST") ?? undefined,
    NOTIFY_SMTP_PORT: Deno.env.get("NOTIFY_SMTP_PORT") ?? undefined,
    NOTIFY_SMTP_USER: Deno.env.get("NOTIFY_SMTP_USER") ?? undefined,
    NOTIFY_SMTP_PASS: Deno.env.get("NOTIFY_SMTP_PASS") ?? undefined,
    NOTIFY_FROM_EMAIL: Deno.env.get("NOTIFY_FROM_EMAIL") ?? undefined,
    NOTIFY_SMS_PROVIDER_KEY: Deno.env.get("NOTIFY_SMS_PROVIDER_KEY") ?? undefined,
    NOTIFY_SMS_API_URL: Deno.env.get("NOTIFY_SMS_API_URL") ?? undefined,
    NOTIFY_SMS_API_KEY: Deno.env.get("NOTIFY_SMS_API_KEY") ?? undefined,
    NOTIFY_WHATSAPP_API_URL: Deno.env.get("NOTIFY_WHATSAPP_API_URL") ?? undefined,
    NOTIFY_WHATSAPP_TOKEN: Deno.env.get("NOTIFY_WHATSAPP_TOKEN") ?? undefined,
  }
}

function trimStr(v: unknown): string {
  return String(v ?? "").trim()
}

/** SMTP del tenant in parametri_operativi, altrimenti secret di piattaforma. */
async function envForRow(
  admin: SupabaseClient,
  row: NotificaOutboxRow,
  base: Record<string, string | undefined>,
): Promise<Record<string, string | undefined>> {
  const tenantId = row.tenant_id
  if (!tenantId) return base
  const { data, error } = await admin
    .from("tenants")
    .select("parametri_operativi")
    .eq("id", tenantId)
    .maybeSingle()
  if (error || !data) return base
  const po = (data as { parametri_operativi?: Record<string, unknown> }).parametri_operativi
  if (!po || typeof po !== "object") return base
  const host = trimStr(po.smtp_host)
  if (!host) return base
  const from = trimStr(po.email_info) || trimStr(po.smtp_user) || base.NOTIFY_FROM_EMAIL
  const user = trimStr(po.smtp_user) || from
  const pass = po.smtp_pass != null ? String(po.smtp_pass) : base.NOTIFY_SMTP_PASS
  const port = trimStr(po.smtp_port) || base.NOTIFY_SMTP_PORT || "465"
  return {
    ...base,
    NOTIFY_SMTP_HOST: host,
    NOTIFY_SMTP_PORT: port,
    NOTIFY_SMTP_USER: user || base.NOTIFY_SMTP_USER,
    NOTIFY_SMTP_PASS: pass,
    NOTIFY_FROM_EMAIL: from,
  }
}

export async function processNotificheOutboxBatch(
  admin: SupabaseClient,
  rows: NotificaOutboxRow[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const baseEnv = envMap()
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows || []) {
    const channel = resolveNotificationChannel(row)
    const adapter = getNotificationAdapter(channel)
    if (!adapter) {
      await admin.rpc("complete_notifiche_outbox_item", {
        p_id: row.id,
        p_stato: "fallito",
        p_ultimo_errore: `canale_sconosciuto:${channel}`,
      })
      failed += 1
      continue
    }

    const env = await envForRow(admin, row, baseEnv)
    const result = await adapter.send({ row, channel, env })

    if (result.ok) {
      await admin.rpc("complete_notifiche_outbox_item", {
        p_id: row.id,
        p_stato: "inviato",
        p_ultimo_errore: null,
      })
      sent += 1
      continue
    }

    const errMsg = `${result.code}:${result.message}`.slice(0, 500)
    if (result.code === "NOT_CONFIGURED" || result.code === "NOT_IMPLEMENTED") {
      await admin.rpc("complete_notifiche_outbox_item", {
        p_id: row.id,
        p_stato: "fallito",
        p_ultimo_errore: errMsg,
      })
      skipped += 1
      continue
    }

    await admin.rpc("complete_notifiche_outbox_item", {
      p_id: row.id,
      p_stato: "fallito",
      p_ultimo_errore: errMsg,
    })
    failed += 1
  }

  return { sent, failed, skipped }
}
