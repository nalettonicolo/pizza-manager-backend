// Edge Function: pubblica/programma una campagna Ads. Se il canale configurato è
// "manuale" aggiorna solo lo stato; se è "n8n" (o "api_diretta") recupera l'integrazione
// attiva per quella piattaforma, invia il payload al webhook configurato e registra
// l'esito in campagne_ads_pubblicazioni_log.
// Vedi sql/modules/81_campagne_ads.sql e sql/modules/82_ads_pubblicazione_automazione.sql.
import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) {
    return jsonResponse({ error: "Authorization richiesta" }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) {
    return jsonResponse({ error: "Sessione non valida" }, 401)
  }
  const userId = userData.user.id

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: ruoloRows, error: ruoloErr } = await admin
    .from("utenti_ruoli")
    .select("ruolo, attivo")
    .eq("user_id", userId)
  if (ruoloErr) {
    console.error("pubblica-campagna-ads: utenti_ruoli", ruoloErr)
    return jsonResponse({ error: "Errore verifica permessi" }, 500)
  }
  const isSuperadmin = (ruoloRows || []).some(
    (r) => (r.attivo ?? true) && ["superadmin", "super_admin"].includes(String(r.ruolo || "").toLowerCase().trim()),
  )
  if (!isSuperadmin) {
    return jsonResponse({ error: "Non autorizzato" }, 403)
  }

  let body: { campagna_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const campagnaId = String(body?.campagna_id || "").trim()
  if (!campagnaId) {
    return jsonResponse({ error: "campagna_id obbligatorio" }, 400)
  }

  const { data: campagna, error: campErr } = await admin
    .from("campagne_ads")
    .select("*")
    .eq("id", campagnaId)
    .maybeSingle()
  if (campErr || !campagna) {
    return jsonResponse({ error: "Campagna non trovata" }, 404)
  }

  const canale = campagna.canale_pubblicazione || "manuale"

  if (canale === "manuale") {
    const { error: updErr } = await admin
      .from("campagne_ads")
      .update({ stato: "attiva", pubblicata_il: new Date().toISOString() })
      .eq("id", campagnaId)
    if (updErr) {
      console.error("pubblica-campagna-ads: update manuale", updErr)
      return jsonResponse({ error: "Errore aggiornamento stato" }, 500)
    }
    return jsonResponse({ ok: true, canale: "manuale", stato: "attiva" })
  }

  const { data: integrazione, error: intErr } = await admin
    .from("integrazioni_automazione")
    .select("*")
    .eq("piattaforma", campagna.piattaforma)
    .eq("attiva", true)
    .eq("tipo", canale === "n8n" ? "n8n_webhook" : "api_diretta")
    .maybeSingle()
  if (intErr) {
    console.error("pubblica-campagna-ads: integrazioni_automazione", intErr)
  }

  if (!integrazione?.url_webhook) {
    await admin.from("campagne_ads_pubblicazioni_log").insert({
      campagna_id: campagnaId,
      integrazione_id: integrazione?.id ?? null,
      esito: "fallito",
      dettaglio: "Nessuna integrazione attiva configurata per questa piattaforma/canale.",
      created_by: userId,
    })
    return jsonResponse(
      { error: "Nessuna integrazione attiva configurata per questa piattaforma. Configura il webhook n8n o passa a pubblicazione manuale." },
      400,
    )
  }

  let esito: "successo" | "fallito" = "successo"
  let dettaglio = ""
  try {
    const resp = await fetch(integrazione.url_webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(integrazione.secret_token ? { Authorization: `Bearer ${integrazione.secret_token}` } : {}),
      },
      body: JSON.stringify({
        campagna_id: campagna.id,
        nome: campagna.nome,
        piattaforma: campagna.piattaforma,
        budget_giornaliero: campagna.budget_giornaliero,
        budget_totale: campagna.budget_totale,
        titolo_annuncio: campagna.titolo_annuncio,
        testo_annuncio: campagna.testo_annuncio,
        url_immagine: campagna.url_immagine,
        cta: campagna.cta,
        utm_source: campagna.utm_source,
        utm_medium: campagna.utm_medium,
        utm_campaign: campagna.utm_campaign,
        utm_content: campagna.utm_content,
        data_pubblicazione_programmata: campagna.data_pubblicazione_programmata,
      }),
    })
    dettaglio = `HTTP ${resp.status}`
    if (!resp.ok) esito = "fallito"
  } catch (e) {
    esito = "fallito"
    dettaglio = e instanceof Error ? e.message : "Errore di rete verso il webhook"
  }

  await admin.from("campagne_ads_pubblicazioni_log").insert({
    campagna_id: campagnaId,
    integrazione_id: integrazione.id,
    esito,
    dettaglio,
    created_by: userId,
  })

  if (esito === "successo") {
    await admin
      .from("campagne_ads")
      .update({
        stato: campagna.data_pubblicazione_programmata ? "programmata" : "attiva",
        pubblicata_il: new Date().toISOString(),
      })
      .eq("id", campagnaId)
  }

  return jsonResponse({ ok: esito === "successo", canale, esito, dettaglio })
})
