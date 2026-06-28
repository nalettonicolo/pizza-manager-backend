export type FiscalOutboxRow = {
  id: string
  tenant_id: string
  kind: string
  payload?: Record<string, unknown>
}

export type FiscalAdapterResult =
  | { ok: true; providerResponse?: Record<string, unknown> }
  | { ok: false; code: string; message: string }

export type FiscalChannelAdapter = {
  id: string
  supports: (kind: string) => boolean
  send: (ctx: {
    row: FiscalOutboxRow
    env: Record<string, string | undefined>
  }) => Promise<FiscalAdapterResult>
}
