// Edge Function: agente AI unico per marketing (sito pubblico PizzaManager, anonimo), supporto
// (staff tenant, autenticato) e cliente (clienti finali del singolo tenant, vetrina pubblica,
// anonimo). Modalità 'supporto' usa tool use per due azioni deterministiche:
// segnala_funzionalita_non_sviluppata (email + tabella) e suggerisci_upgrade (prezzo reale
// da piani_riferimento, mai inventato dal modello). Modalità 'cliente' usa il tool
// stima_tempo_attesa (mai un orario inventato: sempre calcolato da pm_stima_tempo_attesa, stessa
// regola di capacità già in produzione per bloccare gli slot pieni quando un ordine è creato) ed
// è l'unica modalità soggetta a quota mensile (add-on a pagamento per tenant): oltre la soglia
// smette di chiamare Anthropic e risponde con un messaggio statico invece di generare un costo
// scoperto — vedi pm_agente_quota_superata / pm_agente_registra_utilizzo.
//
// Vedi sql/modules/83_agente_ai_configurazione_conversazioni.sql,
// sql/modules/84_agente_supporto_piano_escalation.sql,
// sql/modules/93_stima_tempo_attesa_agente_cliente.sql e
// sql/modules/98_agente_quota_billing_cliente.sql.
//
// Env richiesti:
// - ANTHROPIC_API_KEY (console.anthropic.com — account/costo separato da Claude Code)
// - NOTIFY_SMTP_HOST / NOTIFY_SMTP_PORT / NOTIFY_SMTP_USER / NOTIFY_SMTP_PASS / NOTIFY_FROM_EMAIL
//   (stessi nomi già usati da _shared/notifications/adapters/email-smtp.ts — opzionali: se
//   assenti, l'agente funziona comunque, le segnalazioni restano salvate solo in tabella).
//
// ATTENZIONE — il modello sotto (claude-sonnet-4-5-20250929) e il default in
// agente_configurazione.modello vanno verificati contro i modelli attualmente disponibili su
// console.anthropic.com prima di attivare l'agente in produzione: i nomi modello cambiano nel
// tempo e un id sbagliato fa fallire ogni chiamata con errore 4xx dell'API Anthropic.
import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

const FALLBACK_MODEL = "claude-sonnet-4-5-20250929"
const ANTHROPIC_VERSION = "2023-06-01"

const TOOLS_SUPPORTO = [
  {
    name: "segnala_funzionalita_non_sviluppata",
    description:
      "Usa questo strumento quando il cliente chiede una funzionalità che NON esiste nel prodotto (non è nel catalogo moduli). Registra la richiesta e la gira via email al gestore.",
    input_schema: {
      type: "object",
      properties: {
        riepilogo: { type: "string", description: "Sintesi breve, in italiano, di cosa serve al cliente." },
      },
      required: ["riepilogo"],
    },
  },
  {
    name: "suggerisci_upgrade",
    description:
      "Usa questo strumento quando il cliente chiede una funzionalità che ESISTE ma richiede un piano superiore a quello attuale del tenant. Recupera nome e prezzo reali del piano necessario.",
    input_schema: {
      type: "object",
      properties: {
        chiave_modulo: { type: "string", description: "Chiave del modulo richiesto, es. 'magazzino', 'delivery'." },
      },
      required: ["chiave_modulo"],
    },
  },
]

// Modalità 'cliente': parla con i clienti finali del singolo tenant (vetrina pubblica). Un solo
// tool, deliberatamente: la stima del tempo di attesa non deve MAI essere inventata dal modello,
// va sempre chiesta a pm_stima_tempo_attesa (stessa regola di capacità già usata per bloccare gli
// slot pieni quando un ordine viene creato davvero — vedi sql/modules/93_...).
const TOOLS_CLIENTE = [
  {
    name: "stima_tempo_attesa",
    description:
      "Usa questo strumento OGNI VOLTA che il cliente chiede quanto tempo ci vuole, a che ora può avere l'ordine, o se è possibile ordinare ora. Non inventare mai un orario: chiedilo sempre a questo strumento.",
    input_schema: {
      type: "object",
      properties: {
        quantita_pizze: { type: "integer", description: "Numero di pizze (o piatti equivalenti) nell'ordine ipotizzato. Se non specificato dal cliente, usa 1." },
        tipo_ordine: { type: "string", enum: ["ritiro", "delivery"], description: "ritiro in negozio o consegna a domicilio. Se non specificato, chiedi al cliente prima di usare lo strumento." },
      },
      required: ["quantita_pizze", "tipo_ordine"],
    },
  },
]

async function sendSegnalazioneEmail(env: Record<string, string | undefined>, riepilogo: string, tenantNome: string | null) {
  const host = env.NOTIFY_SMTP_HOST?.trim()
  const from = env.NOTIFY_FROM_EMAIL?.trim()
  if (!host || !from) return { inviata: false, dettaglio: "SMTP non configurato" }
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts")
    const port = Number(env.NOTIFY_SMTP_PORT) || 587
    const user = env.NOTIFY_SMTP_USER?.trim()
    const pass = env.NOTIFY_SMTP_PASS ?? ""
    const client = new SMTPClient({
      connection: { hostname: host, port, tls: port === 465, auth: user ? { username: user, password: pass } : undefined },
    })
    await client.send({
      from,
      to: "info@pizzamanager.it",
      subject: `Richiesta funzionalità non disponibile${tenantNome ? ` — ${tenantNome}` : ""}`,
      content: riepilogo,
    })
    await client.close()
    return { inviata: true, dettaglio: "" }
  } catch (e) {
    return { inviata: false, dettaglio: e instanceof Error ? e.message : "Errore invio email" }
  }
}

async function callAnthropic(env: Record<string, string | undefined>, opts: {
  model: string
  system: string
  messages: Array<{ role: string; content: unknown }>
  tools?: typeof TOOLS_SUPPORTO | typeof TOOLS_CLIENTE
  maxTokens: number
  temperature: number
}) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata")
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      ...(opts.tools ? { tools: opts.tools } : {}),
    }),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    throw new Error(`Anthropic API ${resp.status}: ${text.slice(0, 300)}`)
  }
  return resp.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey)
  const env = Object.fromEntries(
    ["ANTHROPIC_API_KEY", "NOTIFY_SMTP_HOST", "NOTIFY_SMTP_PORT", "NOTIFY_SMTP_USER", "NOTIFY_SMTP_PASS", "NOTIFY_FROM_EMAIL"].map(
      (k) => [k, Deno.env.get(k) ?? undefined],
    ),
  )

  let body: {
    modalita?: string
    sessione_id?: string
    messaggio?: string
    storico?: Array<{ role: string; content: string }>
    tenant_id?: string
    utente_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }

  const modalita =
    body.modalita === "supporto" ? "supporto" : body.modalita === "cliente" ? "cliente" : "marketing"
  const sessioneId = String(body.sessione_id || "").trim()
  const messaggio = String(body.messaggio || "").trim()
  if (!sessioneId || !messaggio) {
    return jsonResponse({ error: "sessione_id e messaggio sono obbligatori" }, 400)
  }

  const { data: config } = await admin.from("agente_configurazione").select("*").maybeSingle()
  if (!config?.attivo) {
    return jsonResponse({ error: "Agente non attivo" }, 403)
  }

  let tenantId: string | null = null
  let tenantNome: string | null = null
  let pianoTenant: string | null = null

  if (modalita === "supporto") {
    // Verifica JWT + appartenenza al tenant dichiarato, per non fidarsi ciecamente del body.
    const authHeader = req.headers.get("Authorization") || ""
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (!jwt) return jsonResponse({ error: "Authorization richiesta per la modalità supporto" }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
    if (userErr || !userData?.user?.id) return jsonResponse({ error: "Sessione non valida" }, 401)

    const richiestoTenantId = String(body.tenant_id || "").trim()
    const { data: ruoliRows } = await admin
      .from("utenti_ruoli")
      .select("ruolo, tenant_id, attivo")
      .eq("user_id", userData.user.id)
    const appartiene = (ruoliRows || []).some((r) => (r.attivo ?? true) && String(r.tenant_id) === richiestoTenantId)
    if (!richiestoTenantId || !appartiene) {
      return jsonResponse({ error: "Non autorizzato per questo tenant" }, 403)
    }
    tenantId = richiestoTenantId

    const { data: tenantRow } = await admin
      .from("tenants")
      .select("nome, piano")
      .eq("id", tenantId)
      .maybeSingle()
    tenantNome = tenantRow?.nome ?? null
    pianoTenant = tenantRow?.piano ?? null
  } else if (modalita === "cliente") {
    // Nessun JWT richiesto: sono i clienti finali del tenant, spesso anonimi sulla vetrina
    // pubblica, prima ancora di registrarsi o ordinare.
    const richiestoTenantId = String(body.tenant_id || "").trim()
    if (!richiestoTenantId) return jsonResponse({ error: "tenant_id richiesto per la modalità cliente" }, 400)
    const { data: tenantRow } = await admin
      .from("tenants")
      .select("nome, piano, attivo")
      .eq("id", richiestoTenantId)
      .maybeSingle()
    if (!tenantRow || tenantRow.attivo === false) {
      return jsonResponse({ error: "Tenant non valido" }, 404)
    }
    tenantId = richiestoTenantId
    tenantNome = tenantRow.nome ?? null
    pianoTenant = tenantRow.piano ?? null
  }

  // ---- Contesto ----
  let systemPrompt =
    modalita === "marketing"
      ? config.system_prompt_marketing
      : modalita === "cliente"
        ? String(config.system_prompt_cliente || "").replaceAll("{NOME_LOCALE}", tenantNome || "la pizzeria")
        : config.system_prompt_supporto
  if (modalita === "marketing") {
    const { data: faq } = await admin.from("faq_pubbliche").select("domanda, risposta").eq("pubblicata", true).order("ordine")
    if (faq?.length) {
      systemPrompt += `\n\nFAQ disponibili (usa queste informazioni, non inventare prezzi o funzionalità):\n${faq
        .map((f) => `D: ${f.domanda}\nR: ${f.risposta}`)
        .join("\n\n")}`
    }
  } else if (modalita === "supporto") {
    const { data: moduli } = await admin.from("moduli_catalogo").select("*")
    systemPrompt += `\n\nIl tenant corrente (${tenantNome || "cliente"}) ha il piano "${pianoTenant || "sconosciuto"}".`
    if (moduli?.length) {
      systemPrompt += `\n\nCatalogo moduli (usa segnala_funzionalita_non_sviluppata se sviluppato=false, suggerisci_upgrade se il piano_minimo è superiore a quello del tenant):\n${moduli
        .map((m) => `- ${m.chiave}: ${m.nome} (piano minimo: ${m.piano_minimo}, sviluppato: ${m.sviluppato})`)
        .join("\n")}`
    }
  } else if (modalita === "cliente") {
    const { data: tenantOrari } = await admin
      .from("tenants")
      .select("orari_settimana")
      .eq("id", tenantId)
      .maybeSingle()
    if (tenantOrari?.orari_settimana) {
      systemPrompt += `\n\nOrari settimanali del locale (JSON, usali per rispondere su apertura/chiusura, non inventare orari):\n${JSON.stringify(tenantOrari.orari_settimana)}`
    }
  }

  const messages: Array<{ role: string; content: unknown }> = [
    ...(body.storico || []).slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    { role: "user", content: messaggio },
  ]

  const model = config.modello || FALLBACK_MODEL
  const maxTokens = config.max_token_risposta || 800
  const temperature = Number(config.temperatura ?? 0.3)

  // Quota (solo modalità 'cliente' — l'add-on a pagamento per tenant, vedi
  // sql/modules/98_agente_quota_billing_cliente.sql): 'marketing' e 'supporto' sono
  // PizzaManager stesso che paga, nessuna quota per quelli.
  if (modalita === "cliente") {
    const { data: superata } = await admin.rpc("pm_agente_quota_superata", { p_tenant_id: tenantId })
    if (superata === true) {
      return jsonResponse({
        risposta:
          "In questo momento non posso rispondere: il locale ha raggiunto il numero di richieste incluse per questo mese. Procedi pure con l'ordine dal sito, o contatta direttamente il locale.",
      })
    }
  }

  let rispostaTesto = ""
  let tokenInputTotale = 0
  let tokenOutputTotale = 0
  try {
    const first = await callAnthropic(env, {
      model,
      system: systemPrompt,
      messages,
      tools: modalita === "supporto" ? TOOLS_SUPPORTO : modalita === "cliente" ? TOOLS_CLIENTE : undefined,
      maxTokens,
      temperature,
    })
    tokenInputTotale += Number(first.usage?.input_tokens) || 0
    tokenOutputTotale += Number(first.usage?.output_tokens) || 0

    const toolUseBlocks = (first.content || []).filter((b: { type: string }) => b.type === "tool_use")

    if (toolUseBlocks.length === 0) {
      rispostaTesto = (first.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n")
    } else {
      const toolResults = []
      for (const block of toolUseBlocks) {
        if (block.name === "segnala_funzionalita_non_sviluppata") {
          const riepilogo = String(block.input?.riepilogo || messaggio)
          const emailEsito = await sendSegnalazioneEmail(env, riepilogo, tenantNome)
          await admin.from("richieste_funzionalita_non_disponibili").insert({
            tenant_id: tenantId,
            sessione_id: sessioneId,
            riepilogo,
            trascrizione: [...(body.storico || []), { role: "user", content: messaggio }],
            email_inviata: emailEsito.inviata,
            email_dettaglio: emailEsito.dettaglio,
          })
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: "Richiesta registrata e girata al gestore. Rispondi al cliente confermando che la richiesta è stata presa in carico.",
          })
        } else if (block.name === "suggerisci_upgrade") {
          const chiave = String(block.input?.chiave_modulo || "")
          const { data: modulo } = await admin.from("moduli_catalogo").select("piano_minimo, nome").eq("chiave", chiave).maybeSingle()
          const { data: piano } = modulo?.piano_minimo
            ? await admin.from("piani_riferimento").select("nome, prezzo_mensile").eq("chiave", modulo.piano_minimo).maybeSingle()
            : { data: null }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: piano
              ? `Il modulo "${modulo?.nome}" richiede il piano ${piano.nome} (${piano.prezzo_mensile}€/mese IVA esclusa). Suggerisci al cliente l'upgrade e di contattare il gestore, usando questo prezzo esatto senza modificarlo.`
              : "Dati piano non trovati: invita il cliente a contattare l'assistenza per i dettagli sull'upgrade.",
          })
        } else if (block.name === "stima_tempo_attesa") {
          const quantita = Math.max(1, Number(block.input?.quantita_pizze) || 1)
          const tipo = block.input?.tipo_ordine === "delivery" ? "delivery" : "ritiro"
          const { data: stima, error: stimaErr } = await admin.rpc("pm_stima_tempo_attesa", {
            p_tenant_id: tenantId,
            p_quantita_pizze: quantita,
            p_tipo_ordine: tipo,
          })
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content:
              !stimaErr && stima
                ? `Risultato stima (dati reali, usa questi valori senza modificarli): ${JSON.stringify(stima)}`
                : "Stima non disponibile al momento: invita il cliente a procedere con l'ordine per vedere l'orario, o a chiamare il locale.",
          })
        }
      }
      const second = await callAnthropic(env, {
        model,
        system: systemPrompt,
        messages: [...messages, { role: "assistant", content: first.content }, { role: "user", content: toolResults }],
        maxTokens,
        temperature,
      })
      tokenInputTotale += Number(second.usage?.input_tokens) || 0
      tokenOutputTotale += Number(second.usage?.output_tokens) || 0
      rispostaTesto = (second.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n")
    }
  } catch (e) {
    console.error("agente-chat: Anthropic call failed", e)
    return jsonResponse({ error: e instanceof Error ? e.message : "Errore chiamata modello" }, 502)
  }

  // Registrata solo dopo una chiamata riuscita, con i token reali — mai stimati. Solo 'cliente'
  // è a quota (vedi sopra); un errore qui non deve far fallire la risposta già ottenuta.
  if (modalita === "cliente" && tenantId) {
    try {
      await admin.rpc("pm_agente_registra_utilizzo", {
        p_tenant_id: tenantId,
        p_token_input: tokenInputTotale,
        p_token_output: tokenOutputTotale,
      })
    } catch (e) {
      console.error("agente-chat: registrazione utilizzo fallita", e)
    }
  }

  const nuovoStorico = [
    ...(body.storico || []),
    { role: "user", content: messaggio, at: new Date().toISOString() },
    { role: "assistant", content: rispostaTesto, at: new Date().toISOString() },
  ]

  const { data: existing } = await admin.from("agente_conversazioni").select("id").eq("sessione_id", sessioneId).maybeSingle()
  if (existing) {
    await admin
      .from("agente_conversazioni")
      .update({ messaggi: nuovoStorico, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
  } else {
    await admin.from("agente_conversazioni").insert({
      sessione_id: sessioneId,
      modalita,
      tenant_id: tenantId,
      utente_id: modalita === "supporto" ? body.utente_id || null : null,
      messaggi: nuovoStorico,
    })
  }

  return jsonResponse({ risposta: rispostaTesto })
})
