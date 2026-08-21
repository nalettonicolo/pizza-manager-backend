import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

/**
 * Auto-assegnazione rider per un ordine delivery, sopra le RPC già esistenti in DB (moduli SQL
 * 41/43 — capacità bauletto, turno aperto, nessuna consegna già in corso sono tutti verificati
 * lato RPC, non qui):
 *
 * - Senza `ORS_API_KEY`: chiama direttamente `assegna_ordine_rider_auto` (mod. 41) — un'unica RPC
 *   che sceglie il rider più vicino in linea d'aria (Haversine) con capacità sufficiente e assegna.
 * - Con `ORS_API_KEY`: usa il flow a due fasi (mod. 43) — `candidati_rider_per_ordine` (top-3 per
 *   Haversine) → per ciascun candidato con posizione nota, calcola l'ETA reale su strada via
 *   OpenRouteService (driving-car) → `assegna_ordine_a_rider` sul candidato con ETA minima,
 *   passando `p_fonte_eta` = "ors" o "haversine" (se ORS non risponde per nessun candidato).
 *
 * Trigger: manuale, bottone "Assegna auto" in DeliveryDashboard.jsx (servizio
 * deliveryAutoAssignService.js). Richiede una sessione utente Supabase valida — le RPC verificano
 * da sole che l'utente abbia un ruolo staff (admin/cassa/delivery/bancone) sul tenant dell'ordine.
 *
 * Deploy: npx supabase functions deploy delivery-assegna-ordine-auto
 */

const ORS_TIMEOUT_MS = 6000
/** Stima ETA grezza quando ORS non è disponibile per nessun candidato (km/h medi urbani). */
const HAVERSINE_KMH_STIMATI = 25

/** Distanza/durata su strada via OpenRouteService; null se non disponibile/fallita. */
async function orsRouteMeters(
  orsApiKey: string,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<{ distanceM: number; durationS: number } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS)
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: orsApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [
          [originLng, originLat],
          [destLng, destLat],
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = await res.json()
    const summary = json?.features?.[0]?.properties?.summary
    if (!summary || typeof summary.distance !== "number" || typeof summary.duration !== "number") return null
    return { distanceM: summary.distance, durationS: summary.duration }
  } catch (e) {
    console.warn("delivery-assegna-ordine-auto: ORS non disponibile, fallback Haversine:", (e as Error).message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

interface Candidato {
  rider_id: string
  rider_nome: string
  lat: number | null
  lng: number | null
  distanza_km: number
  peso_ordine: number
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const orsApiKey = Deno.env.get("ORS_API_KEY") || ""
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500)
  }

  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) {
    return jsonResponse({ error: "authorization_richiesta" }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) {
    return jsonResponse({ error: "sessione_non_valida" }, 401)
  }

  let body: { ordineId?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "body_non_valido" }, 400)
  }
  const ordineId = String(body?.ordineId || "").trim()
  if (!ordineId) {
    return jsonResponse({ error: "ordineId_obbligatorio" }, 400)
  }

  // Senza chiave ORS: un'unica RPC (mod. 41) sceglie ed assegna il rider più vicino in Haversine.
  if (!orsApiKey) {
    const { data, error } = await userClient.rpc("assegna_ordine_rider_auto", { p_ordine_id: ordineId })
    if (error) {
      console.error("delivery-assegna-ordine-auto: assegna_ordine_rider_auto", error)
      return jsonResponse({ error: error.message || "assegnazione_fallita" }, 400)
    }
    const row = Array.isArray(data) ? data[0] : data
    return jsonResponse({
      ok: true,
      ordineId,
      riderId: row?.rider_id ?? null,
      riderNome: row?.rider_nome ?? null,
      metodo: "haversine",
      distanzaKm: row?.distanza_km ?? null,
    })
  }

  // Con chiave ORS: flow a due fasi (mod. 43) con raffinamento su strada.
  const { data: ordine, error: ordineErr } = await userClient
    .from("Ordine")
    .select("id, consegna_lat, consegna_lng")
    .eq("id", ordineId)
    .maybeSingle()
  if (ordineErr) {
    console.error("delivery-assegna-ordine-auto: lookup ordine", ordineErr)
    return jsonResponse({ error: "server_error" }, 500)
  }
  if (!ordine) {
    return jsonResponse({ error: "ordine_non_trovato" }, 404)
  }
  if (ordine.consegna_lat == null || ordine.consegna_lng == null) {
    return jsonResponse({ error: "ordine_senza_coordinate_consegna" }, 400)
  }
  const destLat = Number(ordine.consegna_lat)
  const destLng = Number(ordine.consegna_lng)

  const { data: candidati, error: candErr } = await userClient.rpc("candidati_rider_per_ordine", {
    p_ordine_id: ordineId,
    p_limit: 3,
  })
  if (candErr) {
    console.error("delivery-assegna-ordine-auto: candidati_rider_per_ordine", candErr)
    return jsonResponse({ error: candErr.message || "server_error" }, 400)
  }
  const candidates = (candidati || []) as Candidato[]
  if (candidates.length === 0) {
    return jsonResponse({ error: "nessun_rider_disponibile" }, 409)
  }

  let best: { rider_id: string; rider_nome: string; etaMin: number; metodo: "ors" | "haversine" } | null = null
  for (const c of candidates) {
    if (c.lat == null || c.lng == null) continue
    const route = await orsRouteMeters(orsApiKey, Number(c.lat), Number(c.lng), destLat, destLng)
    const etaMin = route ? route.durationS / 60 : (Number(c.distanza_km) / HAVERSINE_KMH_STIMATI) * 60
    const metodo: "ors" | "haversine" = route ? "ors" : "haversine"
    if (!best || etaMin < best.etaMin) {
      best = { rider_id: c.rider_id, rider_nome: c.rider_nome, etaMin, metodo }
    }
  }
  // Nessun candidato aveva una posizione nota per instradare: usa comunque il primo (già ordinato
  // per distanza Haversine dalla RPC) con una stima ETA grezza.
  if (!best) {
    const c = candidates[0]
    best = {
      rider_id: c.rider_id,
      rider_nome: c.rider_nome,
      etaMin: (Number(c.distanza_km) / HAVERSINE_KMH_STIMATI) * 60,
      metodo: "haversine",
    }
  }

  const { error: assegnaErr } = await userClient.rpc("assegna_ordine_a_rider", {
    p_ordine_id: ordineId,
    p_rider_id: best.rider_id,
    p_eta_minuti: Math.max(1, Math.round(best.etaMin)),
    p_fonte_eta: best.metodo,
  })
  if (assegnaErr) {
    console.error("delivery-assegna-ordine-auto: assegna_ordine_a_rider", assegnaErr)
    return jsonResponse({ error: assegnaErr.message || "assegnazione_fallita" }, 400)
  }

  return jsonResponse({
    ok: true,
    ordineId,
    riderId: best.rider_id,
    riderNome: best.rider_nome,
    metodo: best.metodo,
    etaMinuti: Math.round(best.etaMin),
    candidatiValutati: candidates.length,
  })
})
