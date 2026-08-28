// Chiama l'Edge Function agente-chat (modalità 'marketing' sul sito pubblico, 'supporto'
// nell'app tenant, 'cliente' sulla vetrina di un tenant). Vedi supabase/functions/agente-chat/index.ts,
// sql/modules/83_agente_ai_configurazione_conversazioni.sql, sql/modules/84_agente_supporto_piano_escalation.sql
// e sql/modules/93_stima_tempo_attesa_agente_cliente.sql.
import { supabase } from "@/lib/supabaseClient"

export function nuovaSessioneId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function inviaMessaggioAgente({ modalita, sessioneId, messaggio, storico, tenantId, utenteId }) {
  const richiedeTenantId = modalita === "supporto" || modalita === "cliente"
  const { data, error } = await supabase.functions.invoke("agente-chat", {
    body: {
      modalita,
      sessione_id: sessioneId,
      messaggio,
      storico: storico || [],
      tenant_id: richiedeTenantId ? tenantId : undefined,
      utente_id: modalita === "supporto" ? utenteId : undefined,
    },
  })
  if (error) throw error
  return data
}
