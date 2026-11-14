import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

/**
 * Stub billing Stripe tenant: portal checkout abbonamenti SaaS.
 * Completare con Stripe Billing API + webhook su tenants.stripe_customer_id.
 *
 * Autorizzazione (già attiva, anche se la parte Stripe non c'è ancora): solo un admin attivo del
 * tenant richiesto. Si decide sul token dell'utente (Authorization), non sul corpo: il tenant_id del
 * body è solo il bersaglio, e il ruolo si legge da utenti_ruoli con la service_role.
 * La chiave Stripe (STRIPE_BILLING_SECRET_KEY) va letta SOLO dopo questi controlli, quando si
 * implementerà la sessione del Billing Portal.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  // 1) Token dell'utente: prima di leggere il corpo o qualunque altra configurazione.
  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) return jsonResponse({ error: "Authorization richiesta" }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) return jsonResponse({ error: "Sessione non valida" }, 401)

  // 2) Corpo: serve solo per sapere su quale tenant si vuole operare.
  let body: { tenant_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const tenantId = String(body?.tenant_id || "").trim()
  if (!tenantId) return jsonResponse({ error: "tenant_id obbligatorio" }, 400)

  // 3) Ruolo admin attivo su QUEL tenant, per l'utente del token (mai un user_id dal body).
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: ruoloRow, error: ruoloErr } = await admin
    .from("utenti_ruoli")
    .select("ruolo, attivo")
    .eq("user_id", userData.user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (ruoloErr) {
    console.error("billing-stripe-portal: utenti_ruoli", ruoloErr)
    return jsonResponse({ error: "Errore verifica permessi" }, 500)
  }
  const isAdminTenant = String(ruoloRow?.ruolo || "").trim().toLowerCase() === "admin" && ruoloRow?.attivo !== false
  if (!isAdminTenant) {
    return jsonResponse({ error: "Non autorizzato per questo tenant" }, 403)
  }

  // TODO: creare/recuperare Stripe Customer e sessione Billing Portal
  // (leggere qui STRIPE_BILLING_SECRET_KEY, e rispondere 501 NOT_CONFIGURED se manca).
  return jsonResponse(
    {
      ok: false,
      code: "NOT_IMPLEMENTED",
      message: "billing_stripe_da_completare",
      tenant_id: tenantId,
    },
    501,
  )
})
