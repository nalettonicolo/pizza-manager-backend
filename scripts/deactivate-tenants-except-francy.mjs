/**
 * One-shot: elenca tenant e disattiva tutti tranne Francy Pizza.
 * Uso: node scripts/deactivate-tenants-except-francy.mjs [--apply]
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const projectRef = readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim()
const apply = process.argv.includes("--apply")
const KEEP_ID = "95c0b10f-b677-4131-abd9-e60e8cf9e3bf"
const KEEP_NAME_RE = /francy/i

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  return execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "scripts", "lib", "supabase-cli-token.ps1")],
    { encoding: "utf8" },
  ).trim()
}

async function runQuery(token, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

const token = getAccessToken()
const rows = await runQuery(
  token,
  `SELECT id::text AS id, nome, attivo
   FROM admin.tenants
   ORDER BY nome NULLS LAST`,
)

const list = Array.isArray(rows) ? rows : rows?.data || []
console.log("Tenant attuali:")
for (const t of list) {
  console.log(`- ${t.nome || "(senza nome)"} | ${t.id} | attivo=${t.attivo}`)
}

const keep = list.filter(
  (t) => String(t.id) === KEEP_ID || KEEP_NAME_RE.test(String(t.nome || "")),
)
const drop = list.filter((t) => !keep.some((k) => k.id === t.id))

if (!keep.length) {
  console.error("ERRORE: Francy Pizza non trovata. Abort.")
  process.exit(1)
}
console.log("\nDa conservare:", keep.map((t) => t.nome).join(", "))
console.log("Da disattivare:", drop.map((t) => t.nome || t.id).join(", ") || "(nessuno)")

if (!apply) {
  console.log("\nDry-run. Riesegui con --apply per soft-delete (attivo=false + deleted_at) sui tenant da rimuovere.")
  process.exit(0)
}

if (!drop.length) {
  console.log("Niente da fare.")
  process.exit(0)
}

const ids = drop.map((t) => `'${t.id}'::uuid`).join(", ")
const q = `
UPDATE admin.tenants
SET attivo = false,
    deleted_at = COALESCE(deleted_at, now())
WHERE id IN (${ids});
`
await runQuery(token, q)

// Mirror su public.tenants se presente (vista/tabella legacy)
try {
  await runQuery(
    token,
    `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenants'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'deleted_at'
      ) THEN
        UPDATE public.tenants
        SET attivo = false,
            deleted_at = COALESCE(deleted_at, now())
        WHERE id IN (${ids});
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'attivo'
      ) THEN
        UPDATE public.tenants
        SET attivo = false
        WHERE id IN (${ids});
      END IF;
    END $$;
    `,
  )
} catch (e) {
  console.warn("Mirror public.tenants saltato:", e.message || e)
}

console.log("OK: altri tenant soft-delete (attivo=false, deleted_at), Francy resta attiva.")
