#!/usr/bin/env node
/**
 * Inventario RLS read-only via Management API (token Supabase CLI).
 * Non sostituisce smoke JWT A/B cross-tenant; utile in CI/staging settimanale.
 *
 *   npm run verify:rls-inventory
 *
 * Token: supabase login oppure SUPABASE_ACCESS_TOKEN.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim()
  }
  try {
    return execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", "lib", "supabase-cli-token.ps1"),
      ],
      { encoding: "utf8" },
    ).trim()
  } catch {
    return null
  }
}

async function runQuery(token, projectRef, sql) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Query HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function main() {
  const token = getAccessToken()
  if (!token) {
    console.error("Manca SUPABASE_ACCESS_TOKEN o `supabase login`.")
    console.error("Alternativa manuale: sql/scripts/smoke_rls_cross_tenant.sql in staging.")
    process.exit(1)
  }

  const projectRef = readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim()

  const checks = [
    {
      label: "pm_core_tenant_access",
      sql: `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND proname = 'pm_core_tenant_access' LIMIT 1`,
    },
    {
      label: "policy core pm_core",
      sql: `SELECT count(*)::int AS n FROM pg_policies
            WHERE schemaname = 'core' AND policyname LIKE 'pm_core%'`,
    },
    {
      label: "RLS attivo su core.ordini",
      sql: `SELECT relrowsecurity AS rls_on FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'core' AND c.relname = 'ordini'`,
    },
    {
      label: "RLS attivo su core.righe_ordine (o riga_ordine)",
      sql: `SELECT c.relname, c.relrowsecurity AS rls_on FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'core' AND c.relname IN ('righe_ordine','riga_ordine','ordini_items')
            ORDER BY 1 LIMIT 3`,
    },
    {
      label: "policy admin presenti",
      sql: `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'admin'`,
    },
    {
      label: "pm_public_parametri_operativi (mod.40)",
      sql: `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND proname = 'pm_public_parametri_operativi' LIMIT 1`,
    },
    {
      label: "support_presence SELECT-only authenticated",
      sql: `SELECT
              has_table_privilege('authenticated', 'public.support_presence', 'SELECT') AS puo_leggere,
              has_table_privilege('authenticated', 'public.support_presence', 'INSERT') AS puo_inserire,
              has_table_privilege('authenticated', 'public.support_presence', 'UPDATE') AS puo_aggiornare,
              has_table_privilege('authenticated', 'public.support_presence', 'DELETE') AS puo_cancellare`,
    },
    {
      label: "edge stripe helpers non GRANT ad anon (sample)",
      sql: `SELECT p.proname,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN (
                'save_tenant_stripe_secret',
                'save_tenant_stripe_webhook_secret',
                'tenant_payment_stripe_configured'
              )
            ORDER BY 1`,
    },
  ]

  console.log(`Progetto: ${projectRef}`)
  let failed = false

  for (const c of checks) {
    try {
      const rows = await runQuery(token, projectRef, c.sql)
      const ok = Array.isArray(rows) && rows.length > 0
      console.log(`${ok ? "PASS" : "WARN"} — ${c.label}:`, JSON.stringify(rows?.[0] ?? rows)?.slice(0, 240))
      if (!ok && !c.label.includes("righe_ordine") && !c.label.includes("edge stripe")) failed = true
      if (c.label.includes("support_presence") && rows?.[0]) {
        const r = rows[0]
        if (r.puo_inserire || r.puo_aggiornare || r.puo_cancellare) {
          console.error("FAIL — support_presence: authenticated non dovrebbe avere DML diretto")
          failed = true
        }
      }
      if (c.label.includes("edge stripe") && Array.isArray(rows)) {
        for (const row of rows) {
          if (row.anon_exec === true) {
            console.error(`FAIL — anon può EXECUTE ${row.proname}`)
            failed = true
          }
        }
      }
    } catch (e) {
      console.error(`FAIL — ${c.label}:`, e.message)
      failed = true
    }
  }

  console.log("\nNota: per isolamento tenant reale usare due JWT (tenant A/B) — vedi sql/scripts/README_VERIFY_RLS.md")
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
