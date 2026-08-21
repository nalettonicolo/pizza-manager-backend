import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders as baseCorsHeaders } from "../_shared/cors.ts"
import { verifyJwt } from "../_shared/oauth/jwt.ts"

/**
 * API partner in sola lettura sugli ordini del tenant (scope `read:ordini`), autenticata con il
 * Bearer JWT rilasciato da `oauth-token`. Vedi docs/API_OAUTH_STUB.md.
 *
 * Dati letti via RPC `api_oauth_ordini_list(p_tenant_id, p_limit, p_offset)` (modulo SQL 44) —
 * invocabile solo con la service role key (stesso motivo di `oauth_client_verify_secret`: il
 * tenant arriva dal claim del JWT OAuth già verificato qui sotto, non da una sessione utente
 * Supabase, quindi la vista public."Ordine" — che filtra per auth.uid() — non è utilizzabile).
 *
 * Deploy: npx supabase functions deploy api-v1-ordini --no-verify-jwt
 */

// cors.ts espone solo "POST, OPTIONS": qui serve anche GET.
const corsHeaders = { ...baseCorsHeaders, "Access-Control-Allow-Methods": "GET, OPTIONS" }
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 200

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const jwtSecret = Deno.env.get("OAUTH_JWT_SECRET")
  if (!supabaseUrl || !serviceKey || !jwtSecret) {
    return jsonResponse({ error: "server_misconfigured" }, 500)
  }

  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return jsonResponse({ error: "authorization_richiesta" }, 401)
  }

  let claims: { tenant_id?: string; scope?: string; client_id?: string }
  try {
    claims = await verifyJwt(token, jwtSecret)
  } catch (e) {
    return jsonResponse({ error: "token_non_valido", detail: (e as Error).message }, 401)
  }

  const scopes = String(claims.scope || "").split(/\s+/).filter(Boolean)
  if (!scopes.includes("read:ordini")) {
    return jsonResponse({ error: "scope_insufficiente" }, 403)
  }
  const tenantId = claims.tenant_id
  if (!tenantId) {
    return jsonResponse({ error: "token_non_valido" }, 401)
  }

  const url = new URL(req.url)
  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT
  const offsetParam = Number(url.searchParams.get("offset"))
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0

  const admin = createClient(supabaseUrl, serviceKey)
  const { data, error } = await admin.rpc("api_oauth_ordini_list", {
    p_tenant_id: tenantId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error("api-v1-ordini: rpc api_oauth_ordini_list", error)
    return jsonResponse({ error: "server_error" }, 500)
  }

  return jsonResponse({ data: data || [], count: (data || []).length, client_id: claims.client_id || null })
})
