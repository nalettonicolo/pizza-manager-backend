import type { FiscalChannelAdapter } from "./types.ts"
import { sendRtSdi } from "./adapters/rt-sdi.ts"

const adapters: FiscalChannelAdapter[] = [
  {
    id: "rt_sdi",
    supports: (kind) => kind === "rt_document" || kind === "sdi_invoice",
    send: sendRtSdi,
  },
]

export function resolveFiscalAdapter(row: { kind?: string }) {
  const kind = String(row.kind ?? "").trim()
  return adapters.find((a) => a.supports(kind)) ?? null
}

export function getExportFileHandler() {
  return {
    supports: (kind: string) => kind === "export_file" || kind === "noop_test",
  }
}
