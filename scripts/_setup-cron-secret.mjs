// One-off: genera CRON_SECRET, lo salva nel Vault Supabase e nei secret delle Edge Function.
// Il valore NON viene mai stampato ne scritto su file committati.
import { randomBytes } from "node:crypto"
import {
  repoRootFromHere,
  resolveSupabaseProjectRef,
  getSupabaseAccessToken,
  runSupabaseDatabaseQuery,
} from "./lib/supabaseProjectAccess.mjs"

const root = repoRootFromHere()
const projectRef = resolveSupabaseProjectRef(root)
const token = getSupabaseAccessToken(root)
if (!token) {
  console.error("Token mancante. Esegui `npx supabase login`.")
  process.exit(1)
}

const secret = randomBytes(32).toString("hex") // 64 char hex

function sqlLiteral(v) {
  return "'" + String(v).replace(/'/g, "''") + "'"
}

// 1) Vault: crea o aggiorna il secret 'cron_secret'
const vaultSql = `
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(${sqlLiteral(secret)}, 'cron_secret', 'Secret condiviso cron pg_cron -> Edge Function (x-cron-secret)');
  ELSE
    PERFORM vault.update_secret(v_id, ${sqlLiteral(secret)}, 'cron_secret', 'Secret condiviso cron pg_cron -> Edge Function (x-cron-secret)');
  END IF;
END $$;`

try {
  await runSupabaseDatabaseQuery({ root, sql: vaultSql })
  console.log("OK: secret salvato nel Vault (name=cron_secret)")
} catch (e) {
  console.error("ERRORE Vault:", e.message)
  process.exit(1)
}

// 2) Edge secrets: imposta CRON_SECRET via Management API
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify([{ name: "CRON_SECRET", value: secret }]),
})
if (!res.ok) {
  console.error("ERRORE secret edge:", res.status, await res.text())
  process.exit(1)
}
console.log("OK: CRON_SECRET impostato nei secret delle Edge Function")
console.log("Fatto. Il valore non e stato stampato per sicurezza.")
