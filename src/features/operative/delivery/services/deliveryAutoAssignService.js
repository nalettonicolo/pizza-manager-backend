import { supabase } from "@/lib/supabaseClient"

/**
 * Auto-assegnazione rider per un ordine delivery: invoca l'edge function
 * `delivery-assegna-ordine-auto` (routing OpenRouteService + fallback Haversine, candidati =
 * rider in turno aperto senza consegna attiva — RPC `delivery_candidati_rider`/`delivery_assegna_rider`,
 * modulo SQL 51). Trigger manuale: bottone "Assegna auto" in DeliveryDashboard.jsx.
 * @param {string} ordineId
 * @returns {Promise<{ ok: true, riderId: string, riderNome: string, metodo: "ors"|"haversine"|"sconosciuto" }>}
 */
export async function assegnaRiderAuto(ordineId) {
  if (!ordineId) throw new Error("ordineId obbligatorio")

  const { data: sess } = await supabase.auth.getSession()
  const token = sess?.session?.access_token
  if (!token) throw new Error("Sessione non valida: rientra e riprova.")

  const { data, error } = await supabase.functions.invoke("delivery-assegna-ordine-auto", {
    body: { ordineId },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Assegnazione automatica non riuscita")
  }
  return data
}
