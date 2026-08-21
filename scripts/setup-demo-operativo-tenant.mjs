/**
 * Allinea tenant demo + Cliente Test come **solo cliente** (niente ruolo staff/cassa).
 * L’operativo demo usa gli altri account staff del tenant.
 *   node scripts/setup-demo-operativo-tenant.mjs
 */
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getSupabasePublicConfig, loadProjectEnv } from "./lib/loadEnv.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const TENANT_ID = "95c0b10f-b677-4131-abd9-e60e8cf9e3bf"
const NEW_NAME = "PizzaManager.it"
const DEMO = {
  email: "info@pizzamanager.it",
  password: "DemoCliente!2026",
  nome: "Cliente Test",
  telefono: "123456789",
  indirizzo: "Via Pontedera 4, Padova 35124",
}

function getServiceRoleKey() {
  loadProjectEnv()
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  }
  const out = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "projects", "api-keys", "--project-ref", "flfhrwzlrftuhkrfwzse", "-o", "json"],
    { encoding: "utf8", cwd: root, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] },
  )
  const rows = JSON.parse(out.slice(out.indexOf("[")))
  return rows.find((r) => r.name === "service_role")?.api_key || null
}

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  return execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "scripts", "lib", "supabase-cli-token.ps1")],
    { encoding: "utf8" },
  ).trim()
}

function sqlLit(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

async function execSql(query) {
  const token = getAccessToken()
  const res = await fetch("https://api.supabase.com/v1/projects/flfhrwzlrftuhkrfwzse/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase()
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

async function main() {
  const { baseUrl } = getSupabasePublicConfig()
  const serviceKey = getServiceRoleKey()
  if (!baseUrl || !serviceKey) throw new Error("Manca URL o service_role")

  const admin = createClient(baseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const before = await execSql(
    `SELECT id, nome, slug FROM admin.tenants WHERE id = ${sqlLit(TENANT_ID)}::uuid`,
  )
  console.log("Tenant prima:", JSON.stringify(before))

  await execSql(`
UPDATE admin.tenants
SET nome = ${sqlLit(NEW_NAME)}
WHERE id = ${sqlLit(TENANT_ID)}::uuid;
`)
  console.log("Nome tenant →", NEW_NAME)

  let user = await findUserByEmail(admin, DEMO.email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO.email,
      password: DEMO.password,
      email_confirm: true,
      user_metadata: {
        tenant_id: TENANT_ID,
        nome: DEMO.nome,
        telefono: DEMO.telefono,
        indirizzo: DEMO.indirizzo,
      },
    })
    if (error) throw error
    user = data.user
    console.log("Creato auth user", user.id)
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      password: DEMO.password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        tenant_id: TENANT_ID,
        nome: DEMO.nome,
        telefono: DEMO.telefono,
        indirizzo: DEMO.indirizzo,
      },
    })
    console.log("Aggiornato auth user", user.id)
  }

  await execSql(`
INSERT INTO public.clienti (id, tenant_id, nome, telefono, email, indirizzo)
VALUES (
  ${sqlLit(user.id)}::uuid,
  ${sqlLit(TENANT_ID)}::uuid,
  ${sqlLit(DEMO.nome)},
  ${sqlLit(DEMO.telefono)},
  ${sqlLit(DEMO.email)},
  ${sqlLit(DEMO.indirizzo)}
)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  nome = EXCLUDED.nome,
  telefono = EXCLUDED.telefono,
  email = EXCLUDED.email,
  indirizzo = EXCLUDED.indirizzo;
`)

  await execSql(`
DELETE FROM public.utenti_ruoli
WHERE user_id = ${sqlLit(user.id)}::uuid AND tenant_id = ${sqlLit(TENANT_ID)}::uuid;
`)

  // Niente INSERT in utenti_ruoli: Cliente Test non deve entrare in cassa/operativo.
  // Nota archivio password solo se resta uno staff account separato; qui non creiamo ruolo staff.

  await execSql(`
DELETE FROM public.staff_password_note
WHERE user_id = ${sqlLit(user.id)}::uuid AND tenant_id = ${sqlLit(TENANT_ID)}::uuid;
`)

  await execSql(`
DELETE FROM public.staff_archivio_dipendenti
WHERE tenant_id = ${sqlLit(TENANT_ID)}::uuid AND user_id = ${sqlLit(user.id)}::uuid;
`)

  const after = await execSql(
    `SELECT t.nome, t.slug,
            ur.ruolo IS NOT NULL AS has_staff_role,
            c.email IS NOT NULL AS has_cliente
     FROM admin.tenants t
     LEFT JOIN public.utenti_ruoli ur ON ur.tenant_id = t.id AND ur.user_id = ${sqlLit(user.id)}::uuid
     LEFT JOIN public.clienti c ON c.id = ${sqlLit(user.id)}::uuid
     WHERE t.id = ${sqlLit(TENANT_ID)}::uuid`,
  )
  console.log("OK:", JSON.stringify(after, null, 2))
  console.log(`\nSolo area cliente: ${DEMO.email} / ${DEMO.password}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
