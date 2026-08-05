#!/usr/bin/env node
/**
 * Smoke RLS JWT A/B: staff tenant A non deve leggere ordini del tenant B.
 *
 * Env richiesti (se mancano → exit 0 con SKIP, non fallisce CI senza secrets):
 *   RLS_JWT_A, RLS_JWT_B, RLS_TENANT_A, RLS_TENANT_B
 *   SUPABASE_URL (o VITE_SUPABASE_URL)
 *   SUPABASE_ANON_KEY (o VITE_SUPABASE_ANON_KEY) — apikey header
 *
 *   npm run verify:rls-jwt-ab
 *   REQUIRE_RLS_JWT=1 npm run verify:rls-jwt-ab   # fallisce se env assenti
 */
import { getSupabasePublicConfig } from "./lib/loadEnv.mjs"

function requireEnv(name) {
  return (process.env[name] || "").trim()
}

async function countOrdiniForTenant(baseUrl, anonKey, jwt, tenantId) {
  const url = new URL(`${baseUrl}/rest/v1/Ordine`)
  url.searchParams.set("select", "id")
  url.searchParams.set("tenant_id", `eq.${tenantId}`)
  url.searchParams.set("limit", "5")

  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      Prefer: "count=exact",
    },
  })
  const countHeader = res.headers.get("content-range")
  const body = await res.json().catch(() => null)
  const rows = Array.isArray(body) ? body.length : 0
  // content-range: 0-4/12 or */0
  let total = rows
  if (countHeader && countHeader.includes("/")) {
    const part = countHeader.split("/")[1]
    const n = Number(part)
    if (Number.isFinite(n)) total = n
  }
  return { status: res.status, rows, total, bodySnippet: JSON.stringify(body)?.slice(0, 120) }
}

async function main() {
  const jwtA = requireEnv("RLS_JWT_A")
  const jwtB = requireEnv("RLS_JWT_B")
  const tenantA = requireEnv("RLS_TENANT_A")
  const tenantB = requireEnv("RLS_TENANT_B")
  const requireSecrets = process.env.REQUIRE_RLS_JWT === "1"

  if (!jwtA || !jwtB || !tenantA || !tenantB) {
    const msg =
      "SKIP — impostare RLS_JWT_A, RLS_JWT_B, RLS_TENANT_A, RLS_TENANT_B per smoke cross-tenant."
    console.log(msg)
    if (requireSecrets) process.exit(1)
    process.exit(0)
  }

  const { baseUrl, anonKey } = getSupabasePublicConfig()
  if (!baseUrl || !anonKey) {
    console.error("Mancano SUPABASE_URL / ANON_KEY")
    process.exit(1)
  }

  console.log(`Probing Ordine cross-tenant su ${baseUrl}`)

  // A legge B → atteso 0 righe (o errore auth)
  const aReadsB = await countOrdiniForTenant(baseUrl, anonKey, jwtA, tenantB)
  console.log(`JWT_A → tenant_B: HTTP ${aReadsB.status}, total≈${aReadsB.total}, rows=${aReadsB.rows}`)

  // B legge A → atteso 0
  const bReadsA = await countOrdiniForTenant(baseUrl, anonKey, jwtB, tenantA)
  console.log(`JWT_B → tenant_A: HTTP ${bReadsA.status}, total≈${bReadsA.total}, rows=${bReadsA.rows}`)

  // Sanity: A legge A (può essere 0 se nessun ordine, ma non deve essere 403 se staff)
  const aReadsA = await countOrdiniForTenant(baseUrl, anonKey, jwtA, tenantA)
  console.log(`JWT_A → tenant_A: HTTP ${aReadsA.status}, total≈${aReadsA.total}, rows=${aReadsA.rows}`)

  let failed = false
  if (aReadsB.total > 0 || aReadsB.rows > 0) {
    console.error("FAIL — JWT tenant A ha visto ordini del tenant B")
    failed = true
  }
  if (bReadsA.total > 0 || bReadsA.rows > 0) {
    console.error("FAIL — JWT tenant B ha visto ordini del tenant A")
    failed = true
  }
  if ([aReadsB.status, bReadsA.status].some((s) => s >= 500)) {
    console.error("FAIL — errore server durante probe")
    failed = true
  }

  if (!failed) console.log("PASS — nessun leak cross-tenant su Ordine (sample).")
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
