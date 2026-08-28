// Edge Function: imposta la password REALE (Supabase Auth) di un account staff o cliente di un
// tenant, invocata dalla pagina Superadmin "Archivio password staff" — prima quella pagina
// salvava solo una nota testuale ("password data allo staff"), senza toccare Supabase: bisognava
// aprire il pannello Supabase a parte per applicarla davvero. Richiesta esplicita dell'utente:
// tutto da un solo posto (area superadmin), senza passare da altre piattaforme.
//
// Autorizzazione: SOLO superadmin (stessa regola già applicata al reset password di un account
// esistente in crea-account-staff — mai un admin di tenant, nemmeno per un proprio dipendente).
// L'account target deve appartenere al tenant dichiarato (utenti_ruoli o clienti), altrimenti
// rifiuta: stesso principio del fix di sicurezza su crea-account-staff (niente reset password
// "al buio" su un account a caso).
import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) return jsonResponse({ error: "Authorization richiesta" }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) return jsonResponse({ error: "Sessione non valida" }, 401)

  const isSuperAdmin =
    String(userData.user.app_metadata?.ruolo || userData.user.app_metadata?.role || "").toLowerCase() ===
    "superadmin"
  if (!isSuperAdmin) {
    return jsonResponse({ error: "Solo il superadmin può reimpostare la password di un account." }, 403)
  }

  let body: { tenant_id?: string; user_id?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const tenantId = String(body?.tenant_id || "").trim()
  const targetUserId = String(body?.user_id || "").trim()
  const password = String(body?.password || "")

  if (!tenantId || !targetUserId) {
    return jsonResponse({ error: "tenant_id e user_id obbligatori" }, 400)
  }
  if (password.length < 6) {
    return jsonResponse({ error: "Password troppo corta (minimo 6 caratteri)" }, 400)
  }

  const { data: ruoloRow } = await admin
    .from("utenti_ruoli")
    .select("tenant_id")
    .eq("user_id", targetUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  let appartieneAlTenant = Boolean(ruoloRow)
  if (!appartieneAlTenant) {
    const { data: clienteRow } = await admin
      .from("clienti")
      .select("tenant_id")
      .eq("id", targetUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle()
    appartieneAlTenant = Boolean(clienteRow)
  }
  if (!appartieneAlTenant) {
    return jsonResponse({ error: "Questo account non risulta collegato a questo tenant." }, 403)
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, { password, email_confirm: true })
  if (updErr) {
    console.error("reset-account-password: updateUserById", updErr)
    return jsonResponse({ error: updErr.message || "Aggiornamento password non riuscito" }, 502)
  }

  return jsonResponse({ ok: true })
})
