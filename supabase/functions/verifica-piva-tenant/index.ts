// Edge Function pubblica (nessun login richiesto) usata dal wizard di installazione Windows di
// PizzaManager: durante il setup, chi installa l'app inserisce la Partita IVA della propria
// pizzeria; questa funzione valida il formato (checksum ufficiale della Partita IVA italiana) e,
// se valido, cerca un tenant ATTIVO già esistente con quella P.IVA — il tenant, il suo spazio nel
// database e il suo abbonamento sono sempre creati in anticipo dal superadmin (vedi Tenants.jsx):
// questa funzione non crea né modifica mai nulla, si limita a "riconoscere" l'installazione e
// restituire pochi dati non sensibili (nome, indirizzo, logo) da mostrare nel wizard di setup.
// L'accesso vero all'app resta protetto da email+password come sempre: questo è solo un passaggio
// di riconoscimento/benvenuto, non un login.
//
// Sicurezza: nessun dato sensibile esposto (niente email, telefono, contratti, importi); la
// corrispondenza è sempre esatta sulla P.IVA (mai una ricerca parziale/fuzzy per nome), e il
// controllo del checksum scarta la stragrande maggioranza dei tentativi casuali prima ancora di
// interrogare il database.
import { createClient } from "jsr:@supabase/supabase-js@2.49.2"

// CORS/risposta JSON inline (non da ../_shared/cors.ts): quel percorso relativo ha dato problemi
// di bundling in fase di deploy di questa singola funzione — duplicare queste poche righe è più
// affidabile che dipendere da un file condiviso per un modulo così piccolo.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/** Validazione formale della Partita IVA italiana: 11 cifre con cifra di controllo (algoritmo
 * ufficiale Agenzia delle Entrate). Scarta input non plausibili prima di toccare il database. */
function isValidPartitaIva(piva: string): boolean {
  if (!/^\d{11}$/.test(piva)) return false
  const digits = piva.split("").map(Number)
  let sum = 0
  for (let i = 0; i < 10; i += 1) {
    if (i % 2 === 0) {
      sum += digits[i]
    } else {
      let n = digits[i] * 2
      if (n > 9) n -= 9
      sum += n
    }
  }
  const check = (10 - (sum % 10)) % 10
  return check === digits[10]
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  // Sempre HTTP 200, esito nel campo "ok" (anche per un metodo/body sbagliato): il chiamante
  // principale (PowerShell dentro l'installer NSIS, via Invoke-RestMethod) tratta di default
  // qualunque status diverso da 2xx come eccezione e non arriva a leggere il corpo JSON — più
  // semplice e robusto restituire sempre 200.
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" })
  }

  let pivaRaw = ""
  if (req.method === "GET") {
    pivaRaw = new URL(req.url).searchParams.get("piva") || ""
  } else {
    try {
      const body = await req.json()
      pivaRaw = String(body?.piva ?? "")
    } catch {
      return jsonResponse({ ok: false, reason: "bad_request" })
    }
  }

  const piva = pivaRaw.replace(/\D/g, "")
  if (!isValidPartitaIva(piva)) {
    return jsonResponse({ ok: false, reason: "invalid_format" })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" })
  }
  const admin = createClient(supabaseUrl, serviceKey)

  // "tenants" (schema public) è la vista SELECT su admin.tenants: lo schema "admin" non è esposto
  // via PostgREST, va sempre interrogato tramite questa vista (stesso pattern già usato altrove,
  // es. ricalibra-tempi-attesa).
  const { data, error } = await admin
    .from("tenants")
    .select("id, nome, indirizzo, sede_legale, logo_url")
    .eq("partita_iva", piva)
    .eq("attivo", true)
    .maybeSingle()

  if (error) {
    console.error("verifica-piva-tenant:", error)
    return jsonResponse({ ok: false, reason: "server_error" })
  }
  if (!data) {
    return jsonResponse({ ok: false, reason: "not_found" })
  }

  // sede_legale solo se compilata e diversa dalla sede operativa: evita di ripetere lo stesso
  // indirizzo due volte nel wizard di installazione quando coincidono (caso più comune).
  const sedeLegale =
    data.sede_legale && data.sede_legale.trim() && data.sede_legale.trim() !== (data.indirizzo || "").trim()
      ? data.sede_legale.trim()
      : ""

  return jsonResponse({
    ok: true,
    tenant_id: data.id,
    nome: data.nome || "",
    indirizzo: data.indirizzo || "",
    sede_legale: sedeLegale,
    logo_url: data.logo_url || "",
  })
})
