// Edge Function: crea in blocco gli account Auth "standard" per lo staff di un tenant, dalla
// tabella editabile in Admin → Ruoli → "Crea account standard". Serve una Edge Function (non si
// può fare dal browser) perché creare un utente con password arbitraria richiede la service_role
// key, che non deve mai finire nel bundle frontend — stesso motivo per cui l'unico altro punto del
// repo che crea utenti Auth è uno script Node locale (scripts/setup-demo-operativo-tenant.mjs).
//
// Flusso per ogni riga ricevuta: trova (o crea) l'utente Auth per quell'email, gli imposta la
// password indicata (email_confirm true: nessuna verifica email da attendere, sono account interni
// creati dal titolare), poi collega il ruolo al tenant tramite la RPC già esistente
// aggiungi_ruolo_pizzeria (stessa usata da Admin → Ruoli → "Collega un account staff").
//
// Autorizzazione: solo un admin già attivo sul tenant richiesto può invocarla — verificato leggendo
// utenti_ruoli con la service_role, non fidandosi del tenant_id dichiarato nel body.
import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

type AccountInput = {
  email?: string
  password?: string
  ruolo?: string
  nome_visualizzato?: string
}

const RUOLI_VALIDI = new Set(["admin", "operatore", "cassa", "bancone", "cucina", "pizzaiolo", "delivery", "pony"])

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) return jsonResponse({ error: "Authorization richiesta" }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) return jsonResponse({ error: "Sessione non valida" }, 401)

  let body: { tenant_id?: string; accounts?: AccountInput[] }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }

  const tenantId = String(body.tenant_id || "").trim()
  const accounts = Array.isArray(body.accounts) ? body.accounts : []
  if (!tenantId || accounts.length === 0) {
    return jsonResponse({ error: "tenant_id e almeno un account sono obbligatori" }, 400)
  }
  if (accounts.length > 20) {
    return jsonResponse({ error: "Massimo 20 account per invio." }, 400)
  }

  // Solo un admin attivo di QUESTO tenant può creare account per QUESTO tenant — indipendentemente
  // da cosa dichiara il body. Un superadmin (nessuna riga in utenti_ruoli) passa dalla verifica
  // separata sotto, leggendo il ruolo applicativo da app_metadata come fa il resto della piattaforma.
  const { data: ruoloRow } = await admin
    .from("utenti_ruoli")
    .select("ruolo, attivo")
    .eq("user_id", userData.user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  const isAdminTenant = ruoloRow?.ruolo === "admin" && ruoloRow?.attivo !== false
  const isSuperAdmin = String(userData.user.app_metadata?.ruolo || userData.user.app_metadata?.role || "").toLowerCase() === "superadmin"
  if (!isAdminTenant && !isSuperAdmin) {
    return jsonResponse({ error: "Non autorizzato a creare account per questo tenant" }, 403)
  }

  const risultati: Array<{ email: string; ok: boolean; azione?: string; errore?: string }> = []

  for (const raw of accounts) {
    const email = String(raw?.email || "").trim().toLowerCase()
    const password = String(raw?.password || "")
    const ruolo = String(raw?.ruolo || "").trim().toLowerCase()
    const nomeVisualizzato = String(raw?.nome_visualizzato || "").trim()

    if (!isValidEmail(email)) {
      risultati.push({ email: email || "(vuota)", ok: false, errore: "Email non valida" })
      continue
    }
    if (password.length < 8) {
      risultati.push({ email, ok: false, errore: "Password troppo corta (minimo 8 caratteri)" })
      continue
    }
    if (!RUOLI_VALIDI.has(ruolo)) {
      risultati.push({ email, ok: false, errore: `Ruolo "${ruolo}" non riconosciuto` })
      continue
    }

    try {
      // auth.users è nello schema "auth": con service_role possiamo leggerlo direttamente,
      // evitando di scorrere listUsers() pagina per pagina per trovare l'email.
      const { data: existingRow } = await admin.schema("auth").from("users").select("id").eq("email", email).maybeSingle()

      let azione: string
      let userId: string | null = existingRow?.id ?? null
      if (existingRow?.id) {
        // Bug di sicurezza trovato in audit: senza questo controllo, un admin poteva inserire
        // l'email di QUALSIASI account esistente sulla piattaforma (staff di un altro tenant, o un
        // cliente) e la funzione ne sovrascriveva la password — furto di account cross-tenant.
        // Correzione richiesta esplicitamente dall'utente: il reset password di un account già
        // esistente sui tenant operativi è un'operazione riservata al SOLO superadmin, non
        // all'admin del tenant (nemmeno per un proprio dipendente già collegato).
        if (!isSuperAdmin) {
          throw new Error(
            "Questa email ha già un account: il reset della password è riservato al superadmin. Contatta l'assistenza.",
          )
        }
        const { data: existingRuolo } = await admin
          .from("utenti_ruoli")
          .select("tenant_id")
          .eq("user_id", existingRow.id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
        if (!existingRuolo) {
          throw new Error("Questa email è già registrata su un altro account: usa un indirizzo email diverso.")
        }
        const { error: updErr } = await admin.auth.admin.updateUserById(existingRow.id, { password, email_confirm: true })
        if (updErr) throw updErr
        azione = "password aggiornata su account esistente"
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
        if (createErr) throw createErr
        userId = created?.user?.id ?? null
        azione = "account creato"
      }
      if (!userId) throw new Error("Impossibile determinare l'id dell'account.")

      // Bug funzionale trovato in audit: la RPC aggiungi_ruolo_pizzeria richiede auth.uid() di un
      // admin autenticato via JWT (verifica public.tenant_admins) — chiamata con la service_role
      // key qui, auth.uid() è sempre NULL (il JWT di servizio non ha claim "sub"), quindi falliva
      // SEMPRE con "Solo un admin della pizzeria può aggiungere ruoli": l'account veniva creato ma
      // il ruolo non si collegava mai. L'autorizzazione è già stata verificata sopra (isAdminTenant
      // / isSuperAdmin su tenantId), quindi qui replichiamo la stessa upsert della RPC direttamente
      // con service_role, senza il suo controllo auth.uid() incompatibile con un contesto server.
      const { error: ruoloErr } = await admin
        .from("utenti_ruoli")
        .upsert({ user_id: userId, ruolo, tenant_id: tenantId }, { onConflict: "user_id" })
      if (ruoloErr) throw ruoloErr

      if (nomeVisualizzato) {
        // Best-effort: colonna non garantita su ogni installazione (vedi selectWithoutNome lato
        // client) — un fallimento qui non deve far risultare l'intera riga in errore.
        try {
          await admin
            .from("utenti_ruoli")
            .update({ nome_visualizzato: nomeVisualizzato })
            .eq("tenant_id", tenantId)
            .eq("email", email)
        } catch {
          /* colonna assente su questa installazione: ignorato di proposito */
        }
      }

      risultati.push({ email, ok: true, azione })
    } catch (e) {
      risultati.push({ email, ok: false, errore: e instanceof Error ? e.message : "Errore sconosciuto" })
    }
  }

  return jsonResponse({ risultati })
})
