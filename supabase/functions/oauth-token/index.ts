import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { signJwt } from "../_shared/oauth/jwt.ts"

/**
 * Token endpoint OAuth2 (grant_type=client_credentials) per client machine-to-machine
 * (tabella public.api_oauth_clients). Vedi docs/API_OAUTH_STUB.md.
 *
 * Verifica client_id/secret via RPC `oauth_client_verify_secret` (modulo SQL 44 — bcrypt via
 * pgcrypto, invocabile solo con la service role key: il ruolo nel JWT deve essere
 * `service_role`, verificato dalla RPC stessa).
 *
 * Creazione di un nuovo client (nessuna UI dedicata ancora — da SQL Editor come superadmin):
 *   SELECT * FROM public.superadmin_create_oauth_client(
 *     '<tenant-uuid>', 'Partner XYZ', ARRAY['read:ordini']
 *   );
 *   -- ritorna client_id + client_secret in chiaro UNA SOLA VOLTA: va consegnato al partner subito.
 *
 * Deploy: npx supabase functions deploy oauth-token --no-verify-jwt
 * (i client OAuth non hanno una sessione utente Supabase: verify_jwt di Supabase va disattivato,
 * l'autenticazione la fa questa function su client_id/client_secret).
 */

const TOKEN_TTL_SEC = 3600

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const jwtSecret = Deno.env.get("OAUTH_JWT_SECRET")
  if (!supabaseUrl || !serviceKey || !jwtSecret) {
    return jsonResponse({ error: "server_misconfigured" }, 500)
  }

  let grantType = ""
  let clientId = ""
  let clientSecret = ""
  const contentType = req.headers.get("content-type") || ""
  try {
    if (contentType.includes("application/json")) {
      const body = await req.json()
      grantType = String(body?.grant_type || "")
      clientId = String(body?.client_id || "")
      clientSecret = String(body?.client_secret || "")
    } else {
      // Standard OAuth2: application/x-www-form-urlencoded
      const form = await req.formData()
      grantType = String(form.get("grant_type") || "")
      clientId = String(form.get("client_id") || "")
      clientSecret = String(form.get("client_secret") || "")
    }
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400)
  }

  if (grantType !== "client_credentials") {
    return jsonResponse({ error: "unsupported_grant_type" }, 400)
  }
  if (!clientId || !clientSecret) {
    return jsonResponse({ error: "invalid_request" }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data, error } = await admin.rpc("oauth_client_verify_secret", {
    p_client_id: clientId,
    p_client_secret: clientSecret,
  })
  if (error) {
    console.error("oauth-token: oauth_client_verify_secret", error)
    return jsonResponse({ error: "server_error" }, 500)
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.tenant_id) {
    return jsonResponse({ error: "invalid_client" }, 401)
  }

  const scope = Array.isArray(row.scopes) ? row.scopes.join(" ") : ""
  const accessToken = await signJwt({ client_id: clientId, tenant_id: row.tenant_id, scope }, jwtSecret, TOKEN_TTL_SEC)

  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_TTL_SEC,
    scope,
  })
})
