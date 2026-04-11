/**
 * Chiavi in `parametri_operativi` (JSON tenant) per fiscal / pagamenti remoti.
 * Valori assenti = comportamento sicuro (nessun invio automatico).
 */
export const FISCAL_PARAM_KEYS = Object.freeze({
  /** 'none' | 'export_file' | 'rt_middleware' | 'sdi_bridge' — estensibile */
  fiscal_mode: "fiscal_mode",
  /** identificativo adapter (es. provider SDK) */
  fiscal_provider_key: "fiscal_provider_key",
  /** abilita creazione intent pay-by-link in cassa */
  payment_link_enabled: "payment_link_enabled",
  /** provider PSP per link (es. stripe, sumup, nexi) */
  payment_link_provider_key: "payment_link_provider_key",
  /** abilita suggerimenti export riconciliazione POS manuale (percorso A) */
  pos_manual_export_enabled: "pos_manual_export_enabled",
  /** JSON: predisposizioni/attivazioni per catalogo POS (vedi posIntegrationsRegistry.js) */
  pos_payment_predispositions: "pos_payment_predispositions",
  /** adapter terminale fisico/cloud (percorso C) — es. stripe_terminal, sumup_reader */
  pos_terminal_provider_key: "pos_terminal_provider_key",
})

/** Valori ammessi per fiscal_mode (allineati a implementazioni future). */
export const FISCAL_MODES = Object.freeze({
  NONE: "none",
  EXPORT_FILE: "export_file",
  RT_MIDDLEWARE: "rt_middleware",
  SDI_BRIDGE: "sdi_bridge",
})

/** Kind ammessi in DB `fiscal_outbox.kind` (allineare a migration). */
export const FISCAL_OUTBOX_KINDS = Object.freeze({
  CORRISPETTIVO_RT: "corrispettivo_rt",
  CHIUSURA_GIORNALIERA_RT: "chiusura_giornaliera_rt",
  ANNULLO_RT: "annullo_rt",
  SDI_FATTURA: "sdi_fattura",
  SDI_NOTA_CREDITO: "sdi_nota_credito",
  EXPORT_FILE: "export_file",
  NOOP_TEST: "noop_test",
})

export const FISCAL_OUTBOX_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  SENT: "sent",
  ACK: "ack",
  FAILED: "failed",
  CANCELLED: "cancelled",
})

export const PAYMENT_LINK_STATUS = Object.freeze({
  PENDING: "pending",
  SENT: "sent",
  OPENED: "opened",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
})
