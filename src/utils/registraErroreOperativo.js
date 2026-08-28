import { supabase } from "@/lib/supabaseClient"
import { getCurrentTenantId } from "@/utils/currentTenantContext"

/**
 * Registra un errore operativo per il tenant corrente, per l'alert email periodico al supporto
 * (vedi sql/modules/102_alert_errori_supporto.sql). Non deve MAI rompere il flusso chiamante: ogni
 * fallimento (rete, RPC assente, tenant sconosciuto) viene inghiottito in silenzio — è telemetria,
 * non logica applicativa.
 *
 * @param {object} opts
 * @param {string} opts.origine - es. "frontend:CassaPage", "edge:payment-stripe-refund"
 * @param {string} opts.messaggio - testo breve, senza dati personali del cliente
 * @param {"critico"|"medio"|"basso"} [opts.gravita]
 * @param {object} [opts.dettaglio] - contesto extra serializzabile (mai email/telefono cliente)
 * @param {string} [opts.tenantId] - sovrascrive il tenant corrente noto (usare quando disponibile)
 */
export function registraErroreOperativo({ origine, messaggio, gravita = "critico", dettaglio = {}, tenantId } = {}) {
  const tid = tenantId || getCurrentTenantId()
  if (!tid || !origine || !messaggio) return

  try {
    void supabase
      .rpc("pm_registra_errore_operativo", {
        p_tenant_id: tid,
        p_origine: String(origine).slice(0, 200),
        p_messaggio: String(messaggio).slice(0, 2000),
        p_gravita: gravita,
        p_dettaglio: dettaglio || {},
      })
      .then(({ error }) => {
        if (error) console.warn("[registraErroreOperativo]", error.message)
      })
  } catch {
    // mai propagare: la telemetria non deve mai causare un secondo errore
  }
}
