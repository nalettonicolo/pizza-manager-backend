/**
 * Crea/aggiorna il cliente demo «Cliente Test» e (opzionale) prepara SumUp sul tenant demo.
 *
 *   node scripts/ensure-demo-cliente.mjs
 *   node scripts/ensure-demo-cliente.mjs --sumup
 *
 * Env opzionali:
 *   DEMO_TENANT_ID (default Francy)
 *   DEMO_CLIENTE_EMAIL (default info@pizzamanager.it)
 *   DEMO_CLIENTE_PASSWORD (default DemoCliente!2026)
 *   SUMUP_MERCHANT_CODE + SUMUP_API_KEY (con --sumup)
 *
 * Service role: da `npx supabase projects api-keys` oppure SUPABASE_SERVICE_ROLE_KEY.
 */
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getSupabasePublicConfig, loadProjectEnv } from "./lib/loadEnv.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const FRANCY_TENANT = "95c0b10f-b677-4131-abd9-e60e8cf9e3bf"

const DEMO = {
  nome: "Cliente Test",
  telefono: "123456789",
  email: "info@pizzamanager.it",
  indirizzo: "Via Pontedera 4, Padova 35124",
  password: "DemoCliente!2026",
}

function getServiceRoleKey() {
  loadProjectEnv()
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  }
  try {
    const out = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["supabase", "projects", "api-keys", "--project-ref", "flfhrwzlrftuhkrfwzse", "-o", "json"],
      { encoding: "utf8", cwd: root, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] },
    )
    const jsonStart = out.indexOf("[")
    const json = jsonStart >= 0 ? out.slice(jsonStart) : out
    const rows = JSON.parse(json)
    const row = Array.isArray(rows) ? rows.find((r) => r.name === "service_role" || r.id === "service_role") : null
    return row?.api_key || null
  } catch {
    return null
  }
}

async function findUserByEmail(admin, email) {
  const target = String(email).trim().toLowerCase()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users || []
    const found = users.find((u) => String(u.email || "").toLowerCase() === target)
    if (found) return found
    if (users.length < 200) return null
    page += 1
    if (page > 20) return null
  }
}

async function ensureCliente(admin, tenantId) {
  const email = (process.env.DEMO_CLIENTE_EMAIL || DEMO.email).trim()
  const password = (process.env.DEMO_CLIENTE_PASSWORD || DEMO.password).trim()
  const meta = {
    tenant_id: tenantId,
    nome: DEMO.nome,
    telefono: DEMO.telefono,
    indirizzo: DEMO.indirizzo,
  }

  let user = await findUserByEmail(admin, email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw error
    user = data.user
    console.log("Creato auth user:", email, user.id)
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), ...meta },
    })
    if (error) throw error
    user = data.user
    console.log("Aggiornato auth user:", email, user.id)
  }

  const { error: upErr } = await admin.from("clienti").upsert(
    {
      id: user.id,
      tenant_id: tenantId,
      nome: DEMO.nome,
      telefono: DEMO.telefono,
      email,
      indirizzo: DEMO.indirizzo,
    },
    { onConflict: "id" },
  )
  if (upErr) {
    // Fallback Management API se PostgREST blocca lo schema
    await execSql(`
INSERT INTO public.clienti (id, tenant_id, nome, telefono, email, indirizzo)
VALUES (
  ${sqlLit(user.id)}::uuid,
  ${sqlLit(tenantId)}::uuid,
  ${sqlLit(DEMO.nome)},
  ${sqlLit(DEMO.telefono)},
  ${sqlLit(email)},
  ${sqlLit(DEMO.indirizzo)}
)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  nome = EXCLUDED.nome,
  telefono = EXCLUDED.telefono,
  email = EXCLUDED.email,
  indirizzo = EXCLUDED.indirizzo;
`)
    console.log("Anagrafica clienti OK (via SQL):", DEMO.nome, DEMO.indirizzo)
  } else {
    console.log("Anagrafica clienti OK:", DEMO.nome, DEMO.indirizzo)
  }

  return { userId: user.id, email, password }
}

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim()
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

async function execSql(query) {
  const token = getAccessToken()
  if (!token) throw new Error("Token Management API mancante (supabase login).")
  const res = await fetch(`https://api.supabase.com/v1/projects/flfhrwzlrftuhkrfwzse/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL failed ${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function sqlLit(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

async function ensureSumUp(tenantId) {
  const merchant = String(process.env.SUMUP_MERCHANT_CODE || "").trim().toUpperCase()
  const apiKey = String(process.env.SUMUP_API_KEY || "").trim()
  const wantSumup = process.argv.includes("--sumup") || Boolean(merchant || apiKey)

  if (!wantSumup) {
    console.log("SumUp: saltato (passa --sumup oppure SUMUP_MERCHANT_CODE + SUMUP_API_KEY).")
    return
  }

  if (apiKey && !/^(sup_sk_|sk_test_|sk_live_)/.test(apiKey)) {
    throw new Error("SUMUP_API_KEY non valida (atteso sup_sk_… / sk_test_… / sk_live_…)")
  }

  const merchantSql = merchant ? sqlLit(merchant) : "NULL"
  const keySql = apiKey ? sqlLit(apiKey) : "NULL"

  await execSql(`
DO $demo$
DECLARE
  v_tid UUID := ${sqlLit(tenantId)}::uuid;
  v_merchant TEXT := ${merchantSql};
  v_key TEXT := ${keySql};
BEGIN
  UPDATE admin.tenants t
  SET
    pagamento_online_provider = 'sumup',
    sumup_merchant_public_id = COALESCE(NULLIF(v_merchant, ''), t.sumup_merchant_public_id),
    parametri_operativi = COALESCE(t.parametri_operativi, '{}'::jsonb)
      || jsonb_build_object('ordini_online_attivi', true)
  WHERE t.id = v_tid;

  INSERT INTO admin.tenant_online_payment_providers (
    tenant_id, provider_key, enabled, public_config, sort_order, updated_at
  )
  VALUES (
    v_tid,
    'sumup',
    true,
    CASE
      WHEN COALESCE(v_merchant, '') <> '' THEN jsonb_build_object('sumup_merchant_public_id', v_merchant)
      ELSE COALESCE(
        (SELECT public_config FROM admin.tenant_online_payment_providers p
         WHERE p.tenant_id = v_tid AND p.provider_key = 'sumup'),
        '{}'::jsonb
      )
    END,
    20,
    now()
  )
  ON CONFLICT (tenant_id, provider_key) DO UPDATE
  SET
    enabled = true,
    public_config = CASE
      WHEN COALESCE(v_merchant, '') <> '' THEN jsonb_build_object('sumup_merchant_public_id', v_merchant)
      ELSE admin.tenant_online_payment_providers.public_config
    END,
    updated_at = now();

  IF COALESCE(v_key, '') <> '' THEN
    INSERT INTO admin.tenant_payment_secrets (tenant_id, sumup_api_key, updated_at)
    VALUES (v_tid, v_key, now())
    ON CONFLICT (tenant_id) DO UPDATE
    SET sumup_api_key = EXCLUDED.sumup_api_key, updated_at = now();
  END IF;
END
$demo$;
`)

  if (apiKey && merchant) {
    console.log("SumUp: merchant + API key applicati, ordini vetrina ON.")
  } else if (merchant) {
    console.log("SumUp: merchant", merchant, "— manca SUMUP_API_KEY (completare in Admin).")
  } else if (apiKey) {
    console.log("SumUp: API key salvata — manca SUMUP_MERCHANT_CODE.")
  } else {
    console.log("SumUp: provider abilitato + ordini vetrina ON. Completa merchant/API key in Admin.")
  }
}

async function main() {
  const { baseUrl } = getSupabasePublicConfig()
  if (!baseUrl) {
    console.error("Manca VITE_SUPABASE_URL / SUPABASE_URL")
    process.exit(1)
  }
  const serviceKey = getServiceRoleKey()
  if (!serviceKey) {
    console.error("Manca service_role key (SUPABASE_SERVICE_ROLE_KEY o supabase login + api-keys).")
    process.exit(1)
  }

  const tenantId = String(process.env.DEMO_TENANT_ID || process.env.VITE_PUBLIC_DEMO_TENANT_ID || FRANCY_TENANT).trim()
  const admin = createClient(baseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log("Tenant demo:", tenantId)
  const cliente = await ensureCliente(admin, tenantId)
  await ensureSumUp(tenantId)

  console.log("\n— Credenziali area cliente demo —")
  console.log("Email   :", cliente.email)
  console.log("Password:", cliente.password)
  console.log("Nome    :", DEMO.nome)
  console.log("Tel     :", DEMO.telefono)
  console.log("Indirizzo:", DEMO.indirizzo)
  console.log("\nFrontend (.env):")
  console.log(`VITE_PUBLIC_DEMO_TENANT_ID=${tenantId}`)
  console.log(`VITE_DEMO_CLIENTE_EMAIL=${cliente.email}`)
  console.log(`VITE_DEMO_CLIENTE_PASSWORD=${cliente.password}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
