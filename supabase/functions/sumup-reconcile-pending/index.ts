import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { isSumUpCheckoutPaid, pickSumUpTransaction, sumupApi, type SumUpCheckout } from "../_shared/sumup.ts"
import { assertCronCaller } from "../_shared/cronAuth.ts"

/**
 * Job periodico (pg_cron, ogni 5 min): a differenza di Stripe, SumUp qui non ha un webhook come
 * fonte di verità asincrona — l'ordine viene marcato pagato solo se il client richiama
 * payment-sumup-confirm dopo il redirect. Se il cliente chiude il browser o perde la connessione
 * subito dopo aver pagato (comune su mobile), SumUp incassa ma l'ordine resta IN_ATTESA per
 * sempre. Questa funzione ricontrolla contro l'API SumUp gli ordini rimasti in sospeso e li marca
 * pagati se risultano completati — vedi sql/modules/104_sumup_riconciliazione_pending.sql.
 */
type PendingRow = { ordine_id: string; tenant_id: string; checkout_id: string; updated_at: string }

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }
  const cronDenied = assertCronCaller(req)
  if (cronDenied) return cronDenied

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: rows, error: listErr } = await admin.rpc("edge_sumup_pending_reconciliation", {
    p_max_age_hours: 48,
  })
  if (listErr) {
    console.error("edge_sumup_pending_reconciliation", listErr)
    return new Response(JSON.stringify({ error: listErr.message }), { status: 500 })
  }

  const pending = (rows || []) as PendingRow[]
  let checked = 0
  let marked = 0
  let segnalati = 0

  for (const row of pending) {
    const { data: secret } = await admin.rpc("get_sumup_secret_for_tenant_edge", {
      p_tenant_id: row.tenant_id,
    })
    if (!secret || typeof secret !== "string" || !secret.trim()) continue

    const fetched = await sumupApi<SumUpCheckout>(secret.trim(), `/v0.1/checkouts/${row.checkout_id}`, {
      method: "GET",
    })
    checked++

    if (!fetched.ok || !fetched.data) {
      console.error("sumup reconcile: get checkout failed", row.checkout_id, fetched.status, fetched.raw)
      continue
    }

    if (isSumUpCheckoutPaid(fetched.data)) {
      const { transactionId, transactionCode } = pickSumUpTransaction(fetched.data)
      const { error: markErr } = await admin.rpc("edge_sumup_mark_payment_succeeded", {
        p_checkout_id: row.checkout_id,
        p_transaction_id: transactionId,
        p_transaction_code: transactionCode,
      })
      if (markErr) {
        console.error("edge_sumup_mark_payment_succeeded", markErr)
      } else {
        marked++
      }
      continue
    }

    const status = String(fetched.data.status || "").toUpperCase()
    if (["FAILED", "EXPIRED", "CANCELLED"].includes(status)) {
      // Non tocchiamo l'ordine (resta IN_ATTESA, lo staff decide se ricontattare il cliente):
      // solo visibilità per il supporto, bucket "fallimenti critici backend".
      admin
        .rpc("pm_registra_errore_operativo", {
          p_tenant_id: row.tenant_id,
          p_origine: "cron:sumup-reconcile-pending",
          p_messaggio: `Checkout SumUp ${row.checkout_id} risulta ${status}: l'ordine è rimasto in attesa di pagamento`,
          p_gravita: "medio",
          p_dettaglio: { ordine_id: row.ordine_id, checkout_id: row.checkout_id, sumup_status: status },
        })
        .then(undefined, () => {})
      segnalati++
    }
  }

  return new Response(JSON.stringify({ candidati: pending.length, checked, marked, segnalati }), {
    headers: { "Content-Type": "application/json" },
  })
})
