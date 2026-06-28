import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.49.2"
import { getNotificationAdapter, resolveNotificationChannel } from "./registry.ts"
import type { NotificaOutboxRow } from "./types.ts"

function envMap(): Record<string, string | undefined> {
  return {
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

export async function processNotificheOutboxBatch(
  admin: SupabaseClient,
  rows: NotificaOutboxRow[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const env = envMap()
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
