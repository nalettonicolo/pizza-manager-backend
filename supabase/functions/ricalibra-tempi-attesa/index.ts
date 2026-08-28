// Edge Function: job settimanale di ricalibrazione dei tempi di attesa (Piano B).
//
// Per ogni tenant che ha attivato l'opt-in (parametri_operativi.ricalibrazione_tempi_ai_attiva),
// chiama pm_valuta_calibrazione_settimanale (sola lettura, calcolo deterministico — vedi
// sql/modules/94_calibrazione_tempi_ai_settimanale.sql) e, se propone un cambiamento, crea una
// riga in agente_calibrazione_proposte con lo snapshot completo dei parametri correnti (per poter
// tornare indietro anche dopo l'approvazione) e accoda due notifiche email in notifiche_outbox:
// una al superadmin (per conoscenza) e una all'admin del tenant. NESSUN parametro viene toccato
// qui: solo un umano autorizzato può approvare dal popup in app (Admin o Cassa).
//
// Invocata da pg_cron una volta a settimana (vedi sql/modules/94_...): POST senza body, protetta
// solo dalla service_role key nell'header (stesso pattern di notifiche-outbox-processor).
import { createClient } from "jsr:@supabase/supabase-js@2.49.2"

const SUPERADMIN_EMAIL_FALLBACK = "info@pizzamanager.it"

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceKey)

  // Tenant con l'opt-in attivo — la ricalibrazione automatica è un consenso esplicito, non un
  // default: tocca un parametro che condiziona direttamente cosa i clienti possono ordinare.
  // "tenants" (schema public di default) è la vista SELECT su admin.tenants: lo schema "admin"
  // non è esposto via PostgREST, quindi qui va sempre passato per la vista, mai con .schema("admin").
  const { data: tenants, error: tenantsErr } = await admin
    .from("tenants")
    .select("id, nome, parametri_operativi")
    .eq("attivo", true)

  if (tenantsErr) {
    console.error("ricalibra-tempi-attesa: lettura tenant fallita", tenantsErr)
    return new Response(JSON.stringify({ error: tenantsErr.message }), { status: 500 })
  }

  const idoneiIds = (tenants || [])
    .filter((t) => t.parametri_operativi?.ricalibrazione_tempi_ai_attiva === true)
    .map((t) => t.id)

  const oggi = new Date()
  const periodoA = oggi.toISOString().slice(0, 10)
  const periodoDa = new Date(oggi.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let proposteCreate = 0
  const errori: string[] = []

  for (const tenant of tenants || []) {
    if (!idoneiIds.includes(tenant.id)) continue
    try {
      // Nessuna proposta se ce n'è già una in attesa: evita di accumulare proposte non decise.
      const { count: pendingCount } = await admin
        .from("agente_calibrazione_proposte")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("stato", "in_attesa")
      if ((pendingCount || 0) > 0) continue

      const { data: valutazione, error: valutazioneErr } = await admin.rpc(
        "pm_valuta_calibrazione_settimanale",
        { p_tenant_id: tenant.id },
      )
      if (valutazioneErr) throw valutazioneErr
      if (!valutazione?.proponi) continue

      const backup = tenant.parametri_operativi || {}
      const { data: proposta, error: insertErr } = await admin
        .from("agente_calibrazione_proposte")
        .insert({
          tenant_id: tenant.id,
          parametro: "pizze_ogni_15_min",
          valore_attuale: valutazione.valore_attuale,
          valore_proposto: valutazione.valore_proposto,
          motivo: valutazione.motivo,
          statistiche: valutazione.statistiche || {},
          backup_parametri_operativi: backup,
          periodo_da: periodoDa,
          periodo_a: periodoA,
        })
        .select("id")
        .single()
      if (insertErr) throw insertErr

      proposteCreate += 1
      await accodaNotificheEmail(admin, tenant.id, tenant.nome || "un tenant", valutazione)

      await admin
        .from("agente_calibrazione_proposte")
        .update({ notifiche_accodate: true })
        .eq("id", proposta.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`ricalibra-tempi-attesa: tenant ${tenant.id}`, msg)
      errori.push(`${tenant.id}: ${msg}`)
    }
  }

  return new Response(
    JSON.stringify({ tenant_analizzati: idoneiIds.length, proposte_create: proposteCreate, errori }),
    { headers: { "Content-Type": "application/json" } },
  )
})

async function accodaNotificheEmail(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  tenantNome: string,
  valutazione: { valore_attuale: number; valore_proposto: number; motivo: string },
) {
  const oggetto = `Proposta AI: capacità forno ${tenantNome} (${valutazione.valore_attuale} → ${valutazione.valore_proposto} pizze/15min)`
  const corpo =
    `${tenantNome}: l'analisi settimanale propone di cambiare il limite pizze/15min da ` +
    `${valutazione.valore_attuale} a ${valutazione.valore_proposto}.\n\n${valutazione.motivo}\n\n` +
    `Nessuna modifica è stata applicata: la proposta è in attesa di autorizzazione dall'account admin del tenant (o da Cassa, se ha il permesso di modificare i parametri).`

  // utenti_ruoli non ha colonna email diretta: recupera gli user_id, poi l'email da auth.users
  // (leggibile direttamente con la service_role key).
  const { data: adminRuoli } = await admin
    .from("utenti_ruoli")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("ruolo", "admin")
    .eq("attivo", true)
  const { data: superadminRuoli } = await admin
    .from("utenti_ruoli")
    .select("user_id")
    .in("ruolo", ["superadmin", "super_admin"])
    .eq("attivo", true)

  const adminIds = (adminRuoli || []).map((r: { user_id?: string }) => r.user_id).filter(Boolean)
  const superadminIds = (superadminRuoli || []).map((r: { user_id?: string }) => r.user_id).filter(Boolean)
  const tuttiIds = [...new Set([...adminIds, ...superadminIds])]

  let emailAdmin: string[] = []
  let emailSuperadmin: string[] = []
  if (tuttiIds.length) {
    const { data: users } = await admin.schema("auth").from("users").select("id, email").in("id", tuttiIds)
    const emailById = new Map((users || []).map((u: { id: string; email?: string }) => [u.id, u.email]))
    emailAdmin = adminIds.map((id: string) => emailById.get(id)).filter(Boolean) as string[]
    emailSuperadmin = superadminIds.map((id: string) => emailById.get(id)).filter(Boolean) as string[]
  }

  const destinatari = [...new Set([...emailAdmin, ...emailSuperadmin.length ? emailSuperadmin : [SUPERADMIN_EMAIL_FALLBACK]])]
  if (destinatari.length === 0) return

  const rows = destinatari.map((to) => ({
    tenant_id: tenantId,
    tipo: "calibrazione_ai_proposta",
    destinatario: to,
    payload: { canale: "email", subject: oggetto, body: corpo },
  }))
  await admin.from("notifiche_outbox").insert(rows)
}
