/**
 * Registra una riga nel "Registro attività" (public.log_richieste_sviluppo, visibile solo
 * superadmin in /superadmin/registro-attivita) — un registro UNICO e condiviso di richieste/
 * azioni indipendente da quale assistente AI ha fatto il lavoro (Claude Code, Cursor, ecc.),
 * così l'utente resta sempre allineato su questo progetto senza dover riaprire ogni chat.
 *
 *   node scripts/log-attivita.mjs --richiesta "cosa ha chiesto l'utente" --azioni "cosa hai fatto" [--area "categoria"] [--fonte cursor] [--stato completato] [--branch nome] [--pr-url url]
 *
 * Aree: sicurezza, pagamenti, audit, ai, ui, dati, infrastruttura, marketing, menu, bug.
 * Fonte: cursor | claude | umano | sistema
 * Stato: completato | parziale | bloccato
 *
 * Token: `supabase login` oppure env SUPABASE_ACCESS_TOKEN.
 */
import { repoRootFromHere, runSupabaseDatabaseQuery } from "./lib/supabaseProjectAccess.mjs"

const root = repoRootFromHere(import.meta.url)

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

function sqlTextOrNull(s) {
  const v = String(s || "").trim()
  return v ? `'${sqlEscape(v)}'` : "null"
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const richiesta = (args.richiesta || "").trim()
  const azioni = (args.azioni || "").trim()
  const area = (args.area || "").trim()
  const fonte = (args.fonte || "cursor").trim()
  const stato = (args.stato || "completato").trim()
  const branch = (args.branch || "").trim()
  const prUrl = (args["pr-url"] || args.prUrl || "").trim()

  if (!richiesta || !azioni) {
    console.error(
      'Uso: node scripts/log-attivita.mjs --richiesta "cosa ha chiesto l\'utente" --azioni "cosa hai fatto" [--area "categoria"] [--fonte cursor] [--stato completato]',
    )
    process.exit(1)
  }

  const sql = `insert into public.log_richieste_sviluppo (richiesta, azioni, area, fonte, stato, branch, pr_url)
    values (
      '${sqlEscape(richiesta)}',
      '${sqlEscape(azioni)}',
      ${sqlTextOrNull(area)},
      ${sqlTextOrNull(fonte)},
      ${sqlTextOrNull(stato)},
      ${sqlTextOrNull(branch)},
      ${sqlTextOrNull(prUrl)}
    );`

  try {
    const { projectRef } = await runSupabaseDatabaseQuery({ root, sql })
    console.log("✓ Registrato nel Registro attività:", richiesta, `(${projectRef})`)
  } catch (err) {
    console.error(err?.message || err)
    process.exit(1)
  }
}

main()
