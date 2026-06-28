/** Riga `notifiche_outbox` (subset usato dal worker). */
export type NotificaOutboxRow = {
  id: string
  tenant_id: string
  tipo: string
  destinatario: string
  payload: Record<string, unknown>
  tentativi?: number
}

export type AdapterSendContext = {
  row: NotificaOutboxRow
  /** email | sms | whatsapp | in_app */
  channel: string
  env: Record<string, string | undefined>
}

export type AdapterSendResult =
  | { ok: true }
  | { ok: false; code: "NOT_CONFIGURED" | "NOT_IMPLEMENTED" | "FAILED"; message: string }

export type NotificationChannelAdapter = {
  id: string
  send: (ctx: AdapterSendContext) => Promise<AdapterSendResult>
}
