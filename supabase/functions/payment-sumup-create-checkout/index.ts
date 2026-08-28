import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { sumupApi, type SumUpCheckout } from "../_shared/sumup.ts"

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

  let body: { ordine_id?: string; redirect_url?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }

  const ordineId = String(body?.ordine_id || "").trim()
  const redirectUrl = String(body?.redirect_url || "").trim()
  if (!ordineId) {
    return jsonResponse({ error: "ordine_id obbligatorio" }, 400)
  }
  if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
    return jsonResponse({ error: "redirect_url HTTPS obbligatorio" }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: rows, error: snapErr } = await admin.rpc("edge_ordine_snapshot_for_sumup", {
    p_ordine_id: ordineId,
    p_user_id: userId,
  })
  if (snapErr) {
    console.error("edge_ordine_snapshot_for_sumup", snapErr)
    return jsonResponse({ error: snapErr.message || "Ordine non valido per SumUp" }, 400)
  }
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row?.tenant_id) {
    return jsonResponse({ error: "Ordine non trovato o non pagabile" }, 400)
  }

  const tenantId = row.tenant_id as string
  const totale = Number(row.totale)
  const merchantCode = String(row.merchant_code || "").trim()
  if (!Number.isFinite(totale) || totale <= 0) {
    return jsonResponse({ error: "Totale ordine non valido" }, 400)
  }
  if (totale < 1) {
    return jsonResponse({ error: "Importo troppo basso" }, 400)
  }

  const { data: secret, error: secErr } = await admin.rpc("get_sumup_secret_for_tenant_edge", {
    p_tenant_id: tenantId,
  })
  if (secErr || !secret || typeof secret !== "string" || !secret.trim()) {
    console.error("sumup secret", secErr)
    return jsonResponse({ error: "SumUp non configurato per questo locale (API key)" }, 400)
  }

  // Idempotenza: se l'ordine ha già un checkout SumUp attaccato e non ancora concluso (doppio
  // submit, retry di rete, doppia tab), riusa quello invece di crearne uno nuovo — creare un
  // secondo checkout orfanerebbe il primo (se il cliente lo paga comunque, l'ordine punterebbe al
  // secondo checkout, mai pagato, e la conferma fallirebbe pur avendo Stripe/SumUp incassato).
  const { data: ctxRows } = await admin.rpc("edge_get_ordine_payment_context", { p_ordine_id: ordineId })
  const ctxRow = Array.isArray(ctxRows) ? ctxRows[0] : null
  const existingOnline = (ctxRow?.online_payment ?? {}) as Record<string, string>
  const existingCheckoutId = String(existingOnline?.sumup_checkout_id || "").trim()
  if (existingCheckoutId && existingOnline?.status !== "succeeded") {
    const existing = await sumupApi<SumUpCheckout>(secret.trim(), `/v0.1/checkouts/${existingCheckoutId}`, {
      method: "GET",
    })
    const existingStatus = String(existing.data?.status || "").toUpperCase()
    const stillUsable = existing.ok && existing.data && !["FAILED", "EXPIRED", "CANCELLED"].includes(existingStatus)
    if (stillUsable) {
      const existingHostedUrl = String(existing.data?.hosted_checkout_url || "").trim()
      if (existingHostedUrl) {
        return jsonResponse({
          checkoutId: existingCheckoutId,
          hostedCheckoutUrl: existingHostedUrl,
          checkoutReference: existingCheckoutId,
        })
      }
    }
    // Checkout precedente fallito/scaduto/introvabile: procedi a crearne uno nuovo sotto.
  }

  const checkoutReference = `pm-${ordineId}-${Date.now()}`
  const payload = {
    checkout_reference: checkoutReference,
    amount: Math.round(totale * 100) / 100,
    currency: "EUR",
    merchant_code: merchantCode,
    description: `Ordine ${ordineId.slice(0, 8)}`,
    hosted_checkout: { enabled: true },
    redirect_url: redirectUrl,
  }

  const created = await sumupApi<SumUpCheckout>(secret.trim(), "/v0.1/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  if (!created.ok || !created.data?.id) {
    console.error("sumup create checkout", created.status, created.raw)
    admin
      .rpc("pm_registra_errore_operativo", {
        p_tenant_id: tenantId,
        p_origine: "edge:payment-sumup-create-checkout:create",
        p_messaggio: `SumUp: creazione checkout fallita (HTTP ${created.status})`,
        p_gravita: "critico",
        p_dettaglio: { ordine_id: ordineId, detail: created.raw?.slice(0, 500) || "" },
      })
      .then(undefined, () => {})
    return jsonResponse(
      {
        error: "SumUp: impossibile creare il checkout",
        detail: created.raw?.slice(0, 500) || "",
      },
      502,
    )
  }

  const checkout = created.data
  const hostedUrl = String(checkout.hosted_checkout_url || "").trim()
  if (!hostedUrl) {
    return jsonResponse({ error: "SumUp non ha restituito hosted_checkout_url" }, 502)
  }

  const { error: attachErr } = await admin.rpc("edge_sumup_attach_checkout", {
    p_ordine_id: ordineId,
    p_checkout_id: checkout.id,
    p_status: checkout.status || "PENDING",
    p_amount: totale,
  })
  if (attachErr) {
    console.error("edge_sumup_attach_checkout", attachErr)
    // Grave: SumUp ha già creato il checkout (checkout.id esiste) ma l'ordine non lo sa — se il
    // cliente paga comunque, la riconciliazione periodica (sumup-reconcile-pending) non troverà
    // l'ordine perché non ha sumup_checkout_id in online_payment.
    admin
      .rpc("pm_registra_errore_operativo", {
        p_tenant_id: tenantId,
        p_origine: "edge:payment-sumup-create-checkout:attach",
        p_messaggio: `Checkout SumUp creato (${checkout.id}) ma non associato all'ordine: ${attachErr.message}`,
        p_gravita: "critico",
        p_dettaglio: { ordine_id: ordineId, checkout_id: checkout.id },
      })
      .then(undefined, () => {})
    return jsonResponse({ error: "Impossibile associare il checkout all'ordine" }, 500)
  }

  return jsonResponse({
    checkoutId: checkout.id,
    hostedCheckoutUrl: hostedUrl,
    checkoutReference,
  })
})
