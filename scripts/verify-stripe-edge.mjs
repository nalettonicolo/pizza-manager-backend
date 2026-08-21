#!/usr/bin/env node
/**
 * Verifica raggiungibilità Edge Functions Stripe (senza caricare carte).
 * Atteso: HTTP ≠ 404 (tipicamente 401/405/400/500 senza body valido).
 *
 *   npm run verify:stripe-edge
 */
import { getSupabasePublicConfig } from "./lib/loadEnv.mjs"

const FUNCS = [
  "payment-stripe-create-intent",
  "payment-stripe-confirm",
  "payment-stripe-refund",
  "payment-stripe-webhook",
]

async function probe(baseUrl, name, anonKey) {
  const url = `${baseUrl}/functions/v1/${name}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey || "probe",
      Authorization: `Bearer ${anonKey || "probe"}`,
    },
    body: "{}",
  })
  return { name, status: res.status, ok: res.status !== 404 }
}

async function main() {
  const { baseUrl, anonKey } = getSupabasePublicConfig()
  if (!baseUrl) {
    console.error("Manca VITE_SUPABASE_URL / SUPABASE_URL")
    process.exit(1)
  }

  console.log(`Base: ${baseUrl}`)
  let failed = false
  for (const name of FUNCS) {
    try {
      const r = await probe(baseUrl, name, anonKey)
      console.log(`${r.ok ? "PASS" : "FAIL"} — ${r.name} → HTTP ${r.status}`)
      if (!r.ok) failed = true
    } catch (e) {
      console.error(`FAIL — ${name}:`, e.message)
      failed = true
    }
  }

  console.log(
    "\nNota: NON verifica chiavi TEST/live né firma webhook. " +
      "Configura Admin → Pagamenti online (pk_test_/sk_test_/whsec_). " +
      "Webhook può rispondere 503 senza secret globale e senza payload con PI: ok per reachability. " +
      "Vedi docs/GO_LIVE_FRANCY_RUNBOOK.md § Stripe TEST.",
  )
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
