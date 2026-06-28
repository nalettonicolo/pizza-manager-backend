/**
 * Applica un modulo SQL su Supabase remoto (Management API database/query).
 * Solo patch additive/idempotenti — blocca pattern distruttivi evidenti.
 *
 *   node scripts/apply-sql-module.mjs sql/modules/19_cliente_update_proprio_profilo.sql
 *   npm run sql:apply -- sql/modules/19_cliente_update_proprio_profilo.sql
 *
 * Token: `supabase login` oppure env SUPABASE_ACCESS_TOKEN.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const projectRef = readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim()

/** Pattern vietati senza conferma esplicita (--force). */
const BLOCKED = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bDROP\s+COLUMN\b/i,
]

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

function assertSafeSql(sql, force) {
  if (force) return
  for (const re of BLOCKED) {
    if (re.test(sql)) {
      console.error(
        `Bloccato: SQL contiene pattern non consentito (${re}). Usa --force solo se approvato esplicitamente.`,
      )
      process.exit(1)
    }
  }
}

function resolveModulePath(arg) {
  const p = resolve(root, arg)
  if (!existsSync(p)) {
    console.error(`File non trovato: ${p}`)
    process.exit(1)
  }
  if (!p.replace(/\\/g, "/").includes("/sql/modules/")) {
    console.error("Consentiti solo file sotto sql/modules/")
    process.exit(1)
  }
  return p
}

async function applyQuery(token, sql) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error("apply failed:", res.status, text)
    process.exit(1)
  }
  return text ? JSON.parse(text) : null
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--force")
  const force = process.argv.includes("--force")
  const moduleArg = args[0]

  if (!moduleArg) {
    console.error("Uso: node scripts/apply-sql-module.mjs sql/modules/NN_nome.sql [--force]")
    process.exit(1)
  }

  const path = resolveModulePath(moduleArg)
  const sql = readFileSync(path, "utf8")
  assertSafeSql(sql, force)

  const token = getAccessToken()
  if (!token) {
    console.error("Token mancante. Esegui `npx supabase login` oppure imposta SUPABASE_ACCESS_TOKEN.")
    process.exit(1)
  }

  console.log(`Applicazione ${basename(path)} su ${projectRef}…`)
  const result = await applyQuery(token, sql)
  console.log("OK:", basename(path))
  if (result != null && result !== "" && !(Array.isArray(result) && result.length === 0)) {
    console.log(JSON.stringify(result, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
