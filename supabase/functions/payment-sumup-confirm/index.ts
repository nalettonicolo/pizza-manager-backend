import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { isSumUpCheckoutPaid, pickSumUpTransaction, sumupApi, type SumUpCheckout } from "../_shared/sumup.ts"

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

  let body: { ordine_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const ordineId = String(body?.ordine_id || "").trim()
  if (!ordineId) {
    return jsonResponse({ error: "ordine_id obbligatorio" }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: ctxRows, error: ctxErr } = await admin.rpc("edge_get_ordine_payment_context", {
    p_ordine_id: ordineId,
  })
  if (ctxErr) {
    return jsonResponse({ error: "Contesto pagamento non disponibile" }, 500)
  }
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : null
  const onlinePayment = (ctx?.online_payment ?? {}) as Record<string, string>
  const checkoutId = String(onlinePayment?.sumup_checkout_id || "").trim()
  const tenantId = ctx?.tenant_id as string | undefined

  if (onlinePayment?.status === "succeeded") {
    return jsonResponse({ ok: true, alreadyConfirmed: true })
  }
  if (!checkoutId || !tenantId) {
    return jsonResponse({ error: "Checkout SumUp non associato all'ordine" }, 400)
  }

  const { data: snapRows, error: snapErr } = await admin.rpc("edge_ordine_snapshot_for_sumup", {
    p_ordine_id: ordineId,
    p_user_id: userId,
  })
  if (snapErr) {
    const msg = snapErr.message || ""
    if (msg.includes("non in attesa")) {
      if (onlinePayment?.status === "succeeded") {
        return jsonResponse({ ok: true, alreadyConfirmed: true })
      }
    }
    return jsonResponse({ error: snapErr.message || "Ordine non valido" }, 400)
  }
  if (!Array.isArray(snapRows) || !snapRows[0]) {
    return jsonResponse({ error: "Ordine non trovato" }, 400)
  }

  const { data: secret, error: secErr } = await admin.rpc("get_sumup_secret_for_tenant_edge", {
    p_tenant_id: tenantId,
  })
  if (secErr || !secret || typeof secret !== "string" || !secret.trim()) {
    return jsonResponse({ error: "SumUp non configurato (API key)" }, 400)
  }

  const fetched = await sumupApi<SumUpCheckout>(secret.trim(), `/v0.1/checkouts/${checkoutId}`, {
    method: "GET",
  })
  if (!fetched.ok || !fetched.data) {
    console.error("sumup get checkout", fetched.status, fetched.raw)
    return jsonResponse({ error: "Impossibile verificare il pagamento su SumUp" }, 502)
  }

  if (!isSumUpCheckoutPaid(fetched.data)) {
    return jsonResponse(
      {
        error: `Pagamento non ancora completato (stato SumUp: ${fetched.data.status || "unknown"})`,
        sumupStatus: fetched.data.status || "unknown",
      },
      402,
    )
  }

  const { transactionId, transactionCode } = pickSumUpTransaction(fetched.data)

  const { error: markErr } = await admin.rpc("edge_sumup_mark_payment_succeeded", {
    p_checkout_id: checkoutId,
    p_transaction_id: transactionId,
    p_transaction_code: transactionCode,
  })
  if (markErr) {
    console.error("edge_sumup_mark_payment_succeeded", markErr)
    admin
      .rpc("pm_registra_errore_operativo", {
        p_tenant_id: tenantId,
        p_origine: "edge:payment-sumup-confirm:mark_succeeded",
        p_messaggio: `Pagamento SumUp confermato ma ordine non aggiornato: ${markErr.message}`,
        p_gravita: "critico",
        p_dettaglio: { ordine_id: ordineId, checkout_id: checkoutId },
      })
      .then(undefined, () => {})
    return jsonResponse({ error: markErr.message || "Conferma ordine non riuscita" }, 500)
  }

  return jsonResponse({ ok: true, ordineId, checkoutId })
})
