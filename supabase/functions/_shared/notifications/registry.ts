import type { NotificationChannelAdapter } from "./types.ts"
import { sendEmailSmtp } from "./adapters/email-smtp.ts"
import { sendSms } from "./adapters/sms.ts"
import { sendWhatsApp } from "./adapters/whatsapp.ts"
import { sendInApp } from "./adapters/in-app.ts"

const adapters: NotificationChannelAdapter[] = [
  { id: "email", send: sendEmailSmtp },
  { id: "sms", send: sendSms },
  { id: "whatsapp", send: sendWhatsApp },
  { id: "in_app", send: sendInApp },
]

export function resolveNotificationChannel(row: { payload?: Record<string, unknown> }): string {
  const raw = row.payload?.canale ?? row.payload?.channel
  const c = String(raw ?? "email").trim().toLowerCase()
  if (adapters.some((a) => a.id === c)) return c
  return "email"
}

export function getNotificationAdapter(channel: string): NotificationChannelAdapter | null {
  return adapters.find((a) => a.id === channel) ?? null
}
