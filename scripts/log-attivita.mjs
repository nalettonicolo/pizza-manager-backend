/**
 * Registra una riga nel "Registro attività" (public.log_richieste_sviluppo, visibile solo
 * superadmin in /superadmin/registro-attivita) — un registro UNICO e condiviso di richieste/
 * azioni indipendente da quale assistente AI ha fatto il lavoro (Claude Code, Cursor, ecc.),
 * così l'utente resta sempre allineato su questo progetto senza dover riaprire ogni chat.
 *
 *   node scripts/log-attivita.mjs --richiesta "cosa ha chiesto l'utente" --azioni "cosa hai fatto" [--area "area"]
 *
 * Aree suggerite (facoltativo, solo per raggruppare nella pagina): sicurezza, pagamenti, audit,
 * ai, ui, dati, infrastruttura, marketing, menu, bug.
 *
 * Token: `supabase login` (una tantum sulla macchina) oppure env SUPABASE_ACCESS_TOKEN — stesso
 * meccanismo già usato da scripts/apply-sql-module.mjs, nessuna nuova credenziale da configurare.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const projectRef = readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim()

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

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      out[key] = next != null && !next.startsWith("--") ? next : ""
      if (out[key] !== "") i += 1
    }
  }
  return out
}

function sqlEscape(s) {
  return String(s || "").replace(/'/g, "''")
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const richiesta = (args.richiesta || "").trim()
  const azioni = (args.azioni || "").trim()
  const area = (args.area || "").trim()

  if (!richiesta || !azioni) {
    console.error(
      'Uso: node scripts/log-attivita.mjs --richiesta "cosa ha chiesto l\'utente" --azioni "cosa hai fatto" [--area "area"]',
    )
    process.exit(1)
  }

  const token = getAccessToken()
  if (!token) {
    console.error("Token mancante. Esegui `npx supabase login` oppure imposta SUPABASE_ACCESS_TOKEN.")
    process.exit(1)
  }

  const areaSql = area ? `'${sqlEscape(area)}'` : "null"
  const sql = `insert into public.log_richieste_sviluppo (richiesta, azioni, area) values ('${sqlEscape(richiesta)}', '${sqlEscape(azioni)}', ${areaSql});`

  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error("Registrazione fallita:", res.status, text)
    process.exit(1)
  }
  console.log("✓ Registrato nel Registro attività:", richiesta)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
