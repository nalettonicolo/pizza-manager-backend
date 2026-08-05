#!/usr/bin/env node
/**
 * Smoke remoto mod. 40: get_public_tenant_by_id non deve esporre chiavi operative.
 *
 *   npm run verify:public-po
 *   VERIFY_TENANT_ID=<uuid> npm run verify:public-po
 *
 * Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (o SUPABASE_*).
 */
import { getSupabasePublicConfig } from "./lib/loadEnv.mjs"
import { assertPublicParametriSafe } from "../src/constants/publicParametriOperativiKeys.js"

const DEFAULT_TENANT =
  process.env.VERIFY_TENANT_ID?.trim() ||
  process.env.VITE_PUBLIC_DEMO_TENANT_ID?.trim() ||
  "95c0b10f-b677-4131-abd9-e60e8cf9e3bf"

async function main() {
  const { baseUrl, anonKey } = getSupabasePublicConfig()
  if (!baseUrl || !anonKey) {
    console.error("Mancano VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (o SUPABASE_*).")
    process.exit(1)
  }

  const url = `${baseUrl}/rest/v1/rpc/get_public_tenant_by_id`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_tenant_id: DEFAULT_TENANT }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`RPC fallita HTTP ${res.status}: ${body.slice(0, 400)}`)
    process.exit(1)
  }

  const row = await res.json()
  const po = row?.parametri_operativi ?? {}
  const check = assertPublicParametriSafe(po)

  console.log(`Tenant: ${DEFAULT_TENANT}`)
  console.log(`Nome:   ${row?.nome ?? "—"}`)
  console.log(`Chiavi parametri_operativi (${Object.keys(po).length}): ${Object.keys(po).join(", ") || "(vuoto)"}`)

  if (!check.ok) {
    console.error("FAIL — chiavi non whitelist:", check.extraKeys.join(", ") || "—")
    if (check.leakedForbidden.length) {
      console.error("FAIL — chiavi sensibili rilevate:", check.leakedForbidden.join(", "))
    }
    process.exit(1)
  }

  console.log("PASS — whitelist parametri_operativi rispettata (mod. 40).")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
