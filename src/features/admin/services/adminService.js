import { supabase } from "@/lib/supabaseClient"
import { sortByOrdine } from "@/utils/sortByOrdine"

///////////////////////////////////////////////////////////
// ===================== UTILITY ========================
///////////////////////////////////////////////////////////

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

///////////////////////////////////////////////////////////
// ===================== DASHBOARD ======================
///////////////////////////////////////////////////////////

export async function getTodayOrdersCount(tenantId) {
  const { start, end } = getTodayRange()

  const { count, error } = await supabase
    .from("Ordine")
    .select("*", { count: "exact", head: true })
    .eq("tenantId", tenantId)
    .gte("createdAt", start)
    .lt("createdAt", end)

  if (error) throw error
  return count || 0
}

export async function getTodayRevenue(tenantId) {
  const { start, end } = getTodayRange()

  const { data, error } = await supabase
    .from("Ordine")
    .select("totale")
    .eq("tenantId", tenantId)
    .gte("createdAt", start)
    .lt("createdAt", end)

  if (error) throw error

  return (
    data?.reduce((sum, order) => sum + Number(order.totale ?? order.total ?? 0), 0) || 0
  )
}

export async function getActiveUsersCount(tenantId) {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("attivo", true)

  if (error) throw error
  return count || 0
}

export async function getRecentOrders(tenantId, limit = 5) {
  const { data, error } = await supabase
    .from("Ordine")
    .select("*")
    .eq("tenantId", tenantId)
    .order("createdAt", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * Ordini con filtro opzionale per stato e/o intervallo date (per Cassa giornata odierna, Cucina/Bancone).
 * stati: IN_ATTESA | IN_PREPARAZIONE | PRONTO | CONSEGNATO | ANNULLATO
 * fromDate / toDate: stringhe ISO (es. "2025-03-06T00:00:00.000Z") per filtrare la giornata
 * todayOnly: solo ordini creati nel giorno locale del browser (00:00–24:00, escluso fine intervallo)
 */
export async function getOrders(tenantId, opts = {}) {
  const { stato, limit = 50, fromDate, toDate, todayOnly } = opts
  let q = supabase
    .from("Ordine")
    .select("*")
    .eq("tenantId", tenantId)
    .order("createdAt", { ascending: false })
  if (stato) q = q.eq("stato", stato)
  if (todayOnly) {
    const { start, end } = getTodayRange()
    q = q.gte("createdAt", start).lt("createdAt", end)
  } else {
    if (fromDate != null) q = q.gte("createdAt", fromDate)
    if (toDate != null) q = q.lte("createdAt", toDate)
  }
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

/**
 * Crea un ordine con righe (cassa / cliente).
 * Richiede RPC create_order_with_items e colonne note/tipo_pagamento su core.ordini.
 * @returns {Promise<string>} ID ordine creato
 */
export async function createOrder(tenantId, payload) {
  const {
    totale,
    stato = "IN_PREPARAZIONE",
    items = [],
    note = "",
    tipoPagamento = "",
    tipoOrdine = "",
    nomeCliente = "",
    orarioRitiro = "",
    indirizzoConsegna = "",
  } = payload

  const { data, error } = await supabase.rpc("create_order_with_items", {
    p_tenant_id: tenantId,
    p_totale: Number(totale),
    p_stato: stato,
    p_items: items.map((it) => ({
      prodotto_id: it.prodotto_id ?? it.id,
      quantita: it.quantita ?? it.qty ?? 1,
      prezzo: Number(it.prezzo ?? 0),
      formato_nome: it.formatoNome ?? it.formato_nome ?? null,
      ingredienti_cottura_summary: it.ingredientiCotturaSummary ?? null,
    })),
    p_note: note ?? "",
    p_tipo_pagamento: tipoPagamento ?? "",
    p_tipo_ordine: tipoOrdine ?? "",
    p_nome_cliente: nomeCliente ?? "",
    p_orario_ritiro: orarioRitiro ?? "",
    p_indirizzo_consegna: indirizzoConsegna ?? "",
  })

  if (error) throw error
  return data
}

/** Aggiorna lo stato di un ordine (es. IN_PREPARAZIONE → PRONTO). */
export async function updateOrderStato(ordineId, stato) {
  const { error } = await supabase
    .from("Ordine")
    .update({ stato })
    .eq("id", ordineId)
  if (error) throw error
}

/** Aggiorna il tipo pagamento (es. "Da pagare" → "Contanti" alla riscossione). */
export async function updateOrderTipoPagamento(ordineId, tipoPagamento) {
  const { error } = await supabase
    .from("Ordine")
    .update({ tipo_pagamento: tipoPagamento })
    .eq("id", ordineId)
  if (error) throw error
}

/** Aggiorna dati ordine (nome cliente, orario ritiro, note, tipo pagamento, indirizzo). Per modifica completa dalla cassa. */
export async function updateOrder(ordineId, updates) {
  const row = {}
  if (updates.nome_cliente !== undefined) row.nome_cliente = updates.nome_cliente
  if (updates.orario_ritiro !== undefined) row.orario_ritiro = updates.orario_ritiro
  if (updates.note !== undefined) row.note = updates.note
  if (updates.tipo_pagamento !== undefined) row.tipo_pagamento = updates.tipo_pagamento
  if (updates.indirizzo_consegna !== undefined) row.indirizzo_consegna = updates.indirizzo_consegna
  if (Object.keys(row).length === 0) return
  const { error } = await supabase
    .from("Ordine")
    .update(row)
    .eq("id", ordineId)
  if (error) throw error
}

/** Dettaglio ordine con righe (e nomi prodotto se disponibili). */
export async function getOrderDetail(ordineId) {
  const { data: order, error: orderErr } = await supabase
    .from("Ordine")
    .select("*")
    .eq("id", ordineId)
    .single()
  if (orderErr || !order) throw orderErr || new Error("Ordine non trovato")
  const { data: righe, error: righeErr } = await supabase
    .from("RigaOrdine")
    .select("*")
    .eq("ordineId", ordineId)
  if (righeErr) throw righeErr
  return { ...order, righe: righe || [] }
}

/** Restituisce per ogni ordineId il totale pizze (somma quantita righe). Utile per planning. */
export async function getRigheAggregateByOrdineIds(ordineIds) {
  if (!ordineIds?.length) return {}
  const { data: righe, error } = await supabase
    .from("RigaOrdine")
    .select("ordineId, quantita")
    .in("ordineId", ordineIds)
  if (error) throw error
  const out = {}
  for (const r of righe || []) {
    const id = r.ordineId
    if (id == null) continue
    out[id] = (out[id] || 0) + (Number(r.quantita) || 0)
  }
  return out
}

/** Restituisce tutte le righe ordine per i given ordineIds (per Pizzaioli: nomi pizze e ingredienti). */
export async function getRigheByOrdineIds(ordineIds) {
  if (!ordineIds?.length) return []
  const { data, error } = await supabase
    .from("RigaOrdine")
    .select("*")
    .in("ordineId", ordineIds)
  if (error) throw error
  return data || []
}

/** Chiude la giornata (salvataggio contabilità e reset storico). payload = export ordini del giorno (JSON). */
export async function chiudiGiornata(tenantId, data = null, payload = null) {
  const d = data || new Date().toISOString().slice(0, 10)
  const { data: id, error } = await supabase.rpc("chiudi_giornata", {
    p_tenant_id: tenantId,
    p_data: d,
    p_payload: payload || null,
  })
  if (error) throw error
  return id
}

///////////////////////////////////////////////////////////
// ===================== CLIENTI / ANAGRAFICA ============
///////////////////////////////////////////////////////////

/** Inserisce un'anagrafica cliente (dalla cassa, senza account auth). Alla registrazione self-service con stesso nome+indirizzo+telefono si unisce l'account. */
export async function createAnagraficaCliente(tenantId, payload) {
  const { data, error } = await supabase
    .from("anagrafica_clienti")
    .insert({
      tenant_id: tenantId,
      nome: payload.nome?.trim() || "",
      indirizzo: payload.indirizzo?.trim() || null,
      telefono: payload.telefono?.trim() || null,
      email: payload.email?.trim() || null,
    })
    .select("id, nome, indirizzo, telefono, email, created_at")
    .single()
  if (error) throw error
  return data
}

/** Aggiorna un'anagrafica cliente (dalla cassa). Richiede policy UPDATE su anagrafica_clienti per tenant. */
export async function updateAnagraficaCliente(tenantId, clienteId, payload) {
  const { data, error } = await supabase
    .from("anagrafica_clienti")
    .update({
      nome: payload.nome?.trim() || "",
      indirizzo: payload.indirizzo?.trim() || null,
      telefono: payload.telefono?.trim() || null,
      email: payload.email?.trim() || null,
    })
    .eq("id", clienteId)
    .eq("tenant_id", tenantId)
    .select("id, nome, indirizzo, telefono, email, created_at")
    .single()
  if (error) throw error
  return data
}

/** Cerca anagrafica clienti per tenant (indirizzo, nome, telefono, email). Cerca in ogni colonna con ilike. */
export async function searchAnagraficaClienti(tenantId, query) {
  const q = (query || "").trim()
  if (!tenantId) return []
  const builder = supabase
    .from("anagrafica_clienti")
    .select("id, nome, indirizzo, telefono, email, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100)
  const { data, error } = await builder
  if (error) throw error
  const list = data || []
  if (!q) return list
  const qLower = q.toLowerCase()
  const words = qLower.split(/\s+/).filter(Boolean)
  return list.filter((row) => {
    const searchable = [row.nome, row.indirizzo, row.telefono, row.email].filter(Boolean).join(" ").toLowerCase()
    return words.every((word) => searchable.includes(word))
  })
}

export async function getDashboardStats(tenantId) {
  const [
    ordersCount,
    revenue,
    activeUsers,
    recentOrders,
  ] = await Promise.all([
    getTodayOrdersCount(tenantId),
    getTodayRevenue(tenantId),
    getActiveUsersCount(tenantId),
    getRecentOrders(tenantId),
  ])

  return {
    ordersCount,
    revenue,
    activeUsers,
    recentOrders,
  }
}

///////////////////////////////////////////////////////////
// ===================== USERS ==========================
///////////////////////////////////////////////////////////

export async function getTenantUsers(tenantId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, ruolo, attivo, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function createUserProfile(userData) {
  const { data, error } = await supabase
    .from("profiles")
    .insert(userData)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateUserRole(userId, ruolo) {
  const { error } = await supabase
    .from("profiles")
    .update({ ruolo })
    .eq("id", userId)

  if (error) throw error
}

export async function toggleUserActive(userId, attivo) {
  const { error } = await supabase
    .from("profiles")
    .update({ attivo })
    .eq("id", userId)

  if (error) throw error
}

const AREA_COLUMNS = "accesso_riepilogo, accesso_cassa, accesso_cucina, accesso_bancone, accesso_pizzaiolo, accesso_delivery, accesso_pony"

// Ruoli pizzeria (vista ruoli_pizzeria + RPC)
export async function getRuoliPizzeria(tenantId) {
  let query = supabase
    .from("ruoli_pizzeria")
    .select("user_id, email, ruolo, tenant_id, puo_modificare_parametri, attivo, " + AREA_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("ruolo", { ascending: true })

  let { data, error } = await query
  if (error && error.code === "42703") {
    const fallback = await supabase
      .from("ruoli_pizzeria")
      .select("user_id, email, ruolo, tenant_id, puo_modificare_parametri, attivo")
      .eq("tenant_id", tenantId)
      .order("ruolo", { ascending: true })
    if (fallback.error && fallback.error.code === "42703") {
      const minimal = await supabase
        .from("ruoli_pizzeria")
        .select("user_id, email, ruolo, tenant_id")
        .eq("tenant_id", tenantId)
        .order("ruolo", { ascending: true })
      if (minimal.error) throw minimal.error
      return (minimal.data || []).map((row) => ({
        ...row,
        puo_modificare_parametri: false,
        attivo: true,
        accesso_riepilogo: true,
        accesso_cassa: true,
        accesso_cucina: true,
        accesso_bancone: true,
        accesso_pizzaiolo: true,
        accesso_delivery: true,
        accesso_pony: true,
      }))
    }
    if (fallback.error) throw fallback.error
    return (fallback.data || []).map((row) => ({
      ...row,
      puo_modificare_parametri: row.puo_modificare_parametri ?? false,
      attivo: row.attivo !== false,
      accesso_riepilogo: true,
      accesso_cassa: true,
      accesso_cucina: true,
      accesso_bancone: true,
      accesso_delivery: true,
      accesso_pony: true,
    }))
  }
  if (error) throw error
  return (data || []).map((row) => ({
    ...row,
    accesso_riepilogo: row.accesso_riepilogo !== false,
    accesso_cassa: row.accesso_cassa !== false,
    accesso_cucina: row.accesso_cucina !== false,
    accesso_bancone: row.accesso_bancone !== false,
    accesso_delivery: row.accesso_delivery !== false,
    accesso_pony: row.accesso_pony !== false,
  }))
}

export async function aggiungiRuoloPizzeria(tenantId, email, ruolo) {
  const { data, error } = await supabase.rpc("aggiungi_ruolo_pizzeria", {
    p_email: email,
    p_tenant_id: tenantId,
    p_ruolo: ruolo,
  })
  if (error) throw error
  return data
}

function mapSupabaseRuoliError(error) {
  if (!error) return error
  const code = error.code
  const msg = error.message || ""
  if (code === "42703" || /column .* does not exist/i.test(msg)) {
    const hint =
      "Mancano le colonne permessi su public.utenti_ruoli. Esegui in Supabase lo script sql/PM_UNIFIED_INCREMENTAL.sql (SQL Editor)."
    return new Error(hint + (msg ? ` Dettaglio: ${msg}` : ""))
  }
  if (code === "42501" || /permission denied/i.test(msg)) {
    return new Error(
      "Permesso negato sull’aggiornamento ruoli. Verifica di essere admin del tenant e che esista GRANT UPDATE su public.utenti_ruoli per authenticated."
    )
  }
  return error
}

// Aggiorna permessi aggiuntivi per un ruolo utente (es. puo_modificare_parametri per cassa).
export async function updateRuoloPizzeriaPermessi(tenantId, userId, updates) {
  const { error } = await supabase
    .from("utenti_ruoli")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
  if (error) throw mapSupabaseRuoliError(error)
}

///////////////////////////////////////////////////////////
// ===================== CATEGORIES =====================
///////////////////////////////////////////////////////////

export async function getCategories(tenantId) {
  const { data, error } = await supabase
    .from("categorie")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("ordine", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createCategory(category) {
  const { data, error } = await supabase
    .from("categorie")
    .insert(category)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCategory(categoryId, updates) {
  const { error } = await supabase
    .from("categorie")
    .update(updates)
    .eq("id", categoryId)

  if (error) throw error
}

export async function deleteCategory(categoryId) {
  const { error } = await supabase
    .from("categorie")
    .delete()
    .eq("id", categoryId)

  if (error) throw error
}

export async function getCategoryBySlug(tenantId, slug) {
  const { data, error } = await supabase
    .from("categorie")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw error
  return data
}

///////////////////////////////////////////////////////////
// ===================== INGREDIENTI =====================
///////////////////////////////////////////////////////////

export async function getIngredients(tenantId) {
  const { data, error } = await supabase
    .from("Ingrediente")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createIngredient(payload) {
  const row = {
    id: crypto.randomUUID(),
    tenant_id: payload.tenantId ?? payload.tenant_id,
    nome: payload.nome,
    costo_unitario: payload.costoUnitario ?? payload.costo_unitario ?? payload.costo ?? 0,
  }
  if (payload.costoAbbondante !== undefined) row.costo_abbondante = payload.costoAbbondante
  if (payload.costoSenza !== undefined) row.costo_senza = payload.costoSenza
  if (payload.costoPoco !== undefined) row.costo_poco = payload.costoPoco
  // vaInCottura: invia solo dopo aver eseguito add_va_in_cottura_ingrediente.sql (altrimenti PGRST204)
  if (payload.vaInCottura === true) row.va_in_cottura = true
  if (payload.ordine !== undefined) row.ordine = payload.ordine

  const { data, error } = await supabase
    .from("Ingrediente")
    .insert(row)
    .select("id")
    .single()

  if (error) {
    // Se manca la colonna vaInCottura, riprova senza
    if (error.code === "PGRST204" && error.message?.includes("vaInCottura")) {
      delete row.va_in_cottura
      const retry = await supabase.from("Ingrediente").insert(row).select("id").single()
      if (retry.error) throw retry.error
      return retry.data
    }
    if (error.code === "PGRST204" && (error.message?.includes("va_in_cottura") || error.message?.includes("costo"))) {
      delete row.va_in_cottura
      delete row.costo_abbondante
      delete row.costo_senza
      delete row.costo_poco
      const retry = await supabase.from("Ingrediente").insert(row).select("id").single()
      if (retry.error) throw retry.error
      return retry.data
    }
    if (error.code === "PGRST204" && error.message?.includes("ordine")) {
      delete row.ordine
      const retry = await supabase.from("Ingrediente").insert(row).select("id").single()
      if (retry.error) throw retry.error
      return retry.data
    }
    throw error
  }
  return data
}

export async function updateIngredient(ingredienteId, updates) {
  const row = {}
  if (updates.nome !== undefined) row.nome = updates.nome
  const costoVal = updates.costo_unitario ?? updates.costoUnitario ?? updates.costo
  if (costoVal !== undefined) row.costo_unitario = costoVal
  if (updates.attivo !== undefined) row.attivo = updates.attivo
  if (updates.costoAbbondante !== undefined) row.costo_abbondante = updates.costoAbbondante
  if (updates.costoSenza !== undefined) row.costo_senza = updates.costoSenza
  if (updates.costoPoco !== undefined) row.costo_poco = updates.costoPoco
  if (updates.vaInCottura !== undefined) row.va_in_cottura = updates.vaInCottura
  if (updates.ordine !== undefined) row.ordine = updates.ordine
  if (Object.keys(row).length === 0) return
  const { error } = await supabase
    .from("Ingrediente")
    .update(row)
    .eq("id", ingredienteId)

  if (error) {
    if (error.code === "PGRST204" && error.message?.includes("vaInCottura")) {
      delete row.va_in_cottura
      if (Object.keys(row).length === 0) return
      const { error: retryErr } = await supabase.from("Ingrediente").update(row).eq("id", ingredienteId)
      if (retryErr) throw retryErr
      return
    }
    if (error.code === "PGRST204" && (error.message?.includes("costo") || error.message?.includes("costoAbbondante"))) {
      delete row.costo_abbondante
      delete row.costo_senza
      delete row.costo_poco
      if (Object.keys(row).length === 0) return
      const { error: retryErr } = await supabase.from("Ingrediente").update(row).eq("id", ingredienteId)
      if (retryErr) throw retryErr
      return
    }
    if (error.code === "PGRST204" && error.message?.includes("ordine")) {
      delete row.ordine
      if (Object.keys(row).length === 0) return
      const { error: retryErr } = await supabase.from("Ingrediente").update(row).eq("id", ingredienteId)
      if (retryErr) throw retryErr
      return
    }
    throw error
  }
}

///////////////////////////////////////////////////////////
// ===================== CONFIGURAZIONE COSTI (base pizza) ===
///////////////////////////////////////////////////////////

export async function getConfigurazioneCosti(tenantId) {
  const { data, error } = await supabase
    .from("configurazione_costi")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) return null
  return data
}

export async function upsertConfigurazioneCosti(tenantId, updates) {
  const { data, error } = await supabase
    .from("configurazione_costi")
    .upsert({ tenant_id: tenantId, ...updates }, { onConflict: "tenant_id" })
    .select()
    .single()

  if (error) throw error
  return data
}

///////////////////////////////////////////////////////////
// ===================== ALLERGENI =======================
///////////////////////////////////////////////////////////

export async function getAllergeni(tenantId) {
  const { data, error } = await supabase
    .from("allergeni")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("ordine", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createAllergene(payload) {
  const { data, error } = await supabase
    .from("allergeni")
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAllergene(allergeneId, updates) {
  const { error } = await supabase
    .from("allergeni")
    .update(updates)
    .eq("id", allergeneId)

  if (error) throw error
}

// Allergeni associati a un ingrediente (tabella ingrediente_allergeni)
export async function getIngredienteAllergeni(ingredienteId) {
  const { data, error } = await supabase
    .from("ingrediente_allergeni")
    .select("allergene_id")
    .eq("ingrediente_id", ingredienteId)

  if (error) return []
  return (data || []).map((r) => r.allergene_id)
}

/** Ritorna una mappa ingredienteId -> [allergeneId] per tutti gli ingredienti del tenant */
export async function getIngredienteAllergeniMap(tenantId) {
  const { data, error } = await supabase
    .from("ingrediente_allergeni")
    .select("ingrediente_id, allergene_id")
    .eq("tenant_id", tenantId)
  if (error) return {}
  const map = {}
  for (const row of data || []) {
    const id = row.ingrediente_id
    if (!map[id]) map[id] = []
    map[id].push(row.allergene_id)
  }
  return map
}

export async function setIngredienteAllergeni(tenantId, ingredienteId, allergeneIds) {
  const { error: delErr } = await supabase
    .from("ingrediente_allergeni")
    .delete()
    .eq("ingrediente_id", ingredienteId)
  if (delErr) throw delErr
  if (!allergeneIds?.length) return
  const rows = allergeneIds.map((allergene_id) => ({
    tenant_id: tenantId,
    ingrediente_id: ingredienteId,
    allergene_id,
  }))
  const { error: insErr } = await supabase.from("ingrediente_allergeni").insert(rows)
  if (insErr) throw insErr
}

///////////////////////////////////////////////////////////
// ===================== IMPASTI =======================
///////////////////////////////////////////////////////////

export async function getImpasti(tenantId) {
  if (!tenantId) return []
  try {
    const { data, error } = await supabase
      .from("impasti")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("ordine", { ascending: true })

    if (error) {
      console.warn("getImpasti error:", error.message)
      return []
    }
    return data || []
  } catch (e) {
    console.warn("getImpasti exception:", e)
    return []
  }
}

export async function createImpasto(payload) {
  const { data, error } = await supabase
    .from("impasti")
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateImpasto(impastoId, updates) {
  const { error } = await supabase
    .from("impasti")
    .update(updates)
    .eq("id", impastoId)

  if (error) throw error
}

///////////////////////////////////////////////////////////
// ===================== FORMATI ========================
///////////////////////////////////////////////////////////

export async function getFormati(tenantId) {
  const { data, error } = await supabase
    .from("formati")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("ordine", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createFormato(payload) {
  const { data, error } = await supabase
    .from("formati")
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateFormato(formatoId, updates) {
  const { error } = await supabase
    .from("formati")
    .update(updates)
    .eq("id", formatoId)

  if (error) throw error
}

///////////////////////////////////////////////////////////
// ===================== COTTURA =========================
///////////////////////////////////////////////////////////

export async function getCottura(tenantId) {
  const { data, error } = await supabase
    .from("cottura")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("ordine", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createCottura(payload) {
  const { data, error } = await supabase
    .from("cottura")
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCottura(cotturaId, updates) {
  const { error } = await supabase
    .from("cottura")
    .update(updates)
    .eq("id", cotturaId)

  if (error) throw error
}

///////////////////////////////////////////////////////////
// ===================== PRODUCTS =======================
///////////////////////////////////////////////////////////

export async function getProducts(tenantId) {
  const { data, error } = await supabase
    .from("Prodotto")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome", { ascending: true })

  if (error) throw error
  return sortByOrdine(data || [])
}

/** Prodotti per lista di id (es. per dettaglio ordine). */
export async function getProdottiByIds(tenantId, ids) {
  if (!ids?.length) return []
  const { data, error } = await supabase
    .from("Prodotto")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .in("id", ids)
  if (error) throw error
  return data || []
}

export async function getProductsByCategory(tenantId, categoryId) {
  const { data, error } = await supabase
    .from("Prodotto")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("categoria_id", categoryId)
    .eq("attivo", true)
    .order("nome", { ascending: true })

  if (error) throw error
  return sortByOrdine(data || [])
}

export async function getProductsByCategoryId(tenantId, categoryId) {
  const data = await getProducts(tenantId)
  if (!categoryId) return sortByOrdine(data || [])
  return sortByOrdine(
    (data || []).filter(
      (p) => p.categoria_id === categoryId || p.categoriaId === categoryId
    )
  )
}

/** Mappa prodottoId -> array di ingrediente_id (per sapere quali prodotti contengono un ingrediente). */
export async function getProductIngredientIdsMap(tenantId, productIds) {
  if (!tenantId || !productIds?.length) return {}
  try {
    const { data: rows, error } = await supabase
      .from("prodotto_ingrediente")
      .select("prodotto_id, ingrediente_id")
      .eq("tenant_id", tenantId)
      .in("prodotto_id", productIds)
    if (error || !rows?.length) return {}
    const byProduct = {}
    for (const r of rows) {
      const pid = r.prodotto_id
      if (!byProduct[pid]) byProduct[pid] = []
      byProduct[pid].push(r.ingrediente_id)
    }
    return byProduct
  } catch (e) {
    console.warn("getProductIngredientIdsMap error:", e)
    return {}
  }
}

/**
 * Mappa prodottoId -> elenco nomi ingredienti (per lista pizze e home).
 * Ordine come in prodotto_ingrediente.
 */
export async function getProductIngredientiMap(tenantId, productIds) {
  if (!tenantId || !productIds?.length) return {}
  try {
    const { data: rows, error } = await supabase
      .from("prodotto_ingrediente")
      .select("prodotto_id, ingrediente_id, ordine")
      .eq("tenant_id", tenantId)
      .in("prodotto_id", productIds)
      .order("ordine", { ascending: true })
    if (error || !rows?.length) return {}
    const byProduct = {}
    for (const r of rows) {
      const pid = r.prodotto_id
      if (!byProduct[pid]) byProduct[pid] = []
      byProduct[pid].push(r.ingrediente_id)
    }
    const allIngIds = [...new Set(rows.map((r) => r.ingrediente_id).filter(Boolean))]
    let nomeById = {}
    const { data: ingredients, error: err2 } = await supabase
      .from("Ingrediente")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .in("id", allIngIds)
    if (err2 || !ingredients?.length) {
      const fallback = await supabase.from("ingredienti").select("id, nome").eq("tenant_id", tenantId).in("id", allIngIds)
      if (!fallback.error && fallback.data?.length) {
        nomeById = Object.fromEntries(fallback.data.map((i) => [i.id, i.nome ?? ""]))
      } else {
        return byProduct
      }
    } else {
      nomeById = Object.fromEntries(ingredients.map((i) => [i.id, i.nome ?? ""]))
    }
    const out = {}
    for (const [pid, ids] of Object.entries(byProduct)) {
      out[pid] = ids.map((id) => nomeById[id] || "").filter(Boolean)
    }
    return out
  } catch (e) {
    console.warn("getProductIngredientiMap error:", e)
    return {}
  }
}

/**
 * Stesso output di {@link getProductIngredienti} ma in 2–3 round-trip (schermate operative con molte pizze).
 * @returns {Promise<Record<string, Array<{ nome: string, vaInCottura: boolean }>>>}
 */
export async function getProductIngredientiBatch(tenantId, productIds) {
  if (!tenantId || !productIds?.length) return {}
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  const emptyMap = () => Object.fromEntries(uniqueIds.map((id) => [id, []]))
  try {
    let rows
    const { data: dataWithOrdine, error: errOrdine } = await supabase
      .from("prodotto_ingrediente")
      .select("prodotto_id, ingrediente_id, ordine")
      .eq("tenant_id", tenantId)
      .in("prodotto_id", uniqueIds)
      .order("prodotto_id", { ascending: true })
      .order("ordine", { ascending: true })
    if (errOrdine && (errOrdine.code === "PGRST204" || errOrdine.message?.includes("ordine"))) {
      const { data: dataNoOrdine, error } = await supabase
        .from("prodotto_ingrediente")
        .select("prodotto_id, ingrediente_id")
        .eq("tenant_id", tenantId)
        .in("prodotto_id", uniqueIds)
      if (error || !dataNoOrdine?.length) return emptyMap()
      rows = dataNoOrdine
    } else if (errOrdine || !dataWithOrdine?.length) {
      return emptyMap()
    } else {
      rows = dataWithOrdine
    }

    const byProd = {}
    for (const r of rows) {
      const pid = r.prodotto_id
      if (!byProd[pid]) byProd[pid] = []
      byProd[pid].push(r)
    }
    const allIngIds = [...new Set(rows.map((r) => r.ingrediente_id).filter(Boolean))]
    if (!allIngIds.length) return emptyMap()

    const fullCols = "id, nome, vaInCottura, va_in_cottura, costo_unitario, costo_abbondante, costo_senza, costo_poco"
    let { data: ingredients, error: err2 } = await supabase
      .from("Ingrediente")
      .select(fullCols)
      .eq("tenant_id", tenantId)
      .in("id", allIngIds)
    if (err2 && (err2.code === "PGRST204" || err2.message?.includes("column"))) {
      const fallback = await supabase
        .from("Ingrediente")
        .select("id, nome, va_in_cottura, costo_unitario")
        .eq("tenant_id", tenantId)
        .in("id", allIngIds)
      ingredients = fallback.data
      err2 = fallback.error
    }
    if (err2 || !ingredients?.length) return emptyMap()
    const byId = new Map(ingredients.map((ing) => [ing.id, ing]))

    const out = {}
    for (const pid of uniqueIds) {
      const prRows = byProd[pid]
      if (!prRows?.length) {
        out[pid] = []
        continue
      }
      const ids = prRows.map((r) => r.ingrediente_id).filter(Boolean)
      let ordered = ids.map((id) => byId.get(id)).filter(Boolean)
      if (prRows[0] && prRows[0].ordine === undefined) {
        ordered = ordered.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      }
      out[pid] = ordered.map((ing) => ({
        nome: ing.nome ?? "",
        vaInCottura: ing.vaInCottura === true || ing.va_in_cottura === true,
      }))
    }
    return out
  } catch (e) {
    console.warn("getProductIngredientiBatch error:", e)
    return emptyMap()
  }
}

/** Ingredienti associati a un prodotto (per modale in cottura in cassa/cliente). Ritorna [] se nessun ingrediente o tabella mancante.
 *  Ordine: segue l'ordine di inserimento nella pizza (ordine in prodotto_ingrediente) per menu e schermate operative. */
export async function getProductIngredienti(tenantId, productId) {
  if (!tenantId || !productId) return []
  try {
    let rows
    const { data: dataWithOrdine, error: errOrdine } = await supabase
      .from("prodotto_ingrediente")
      .select("ingrediente_id, ordine")
      .eq("prodotto_id", productId)
      .eq("tenant_id", tenantId)
      .order("ordine", { ascending: true })
    if (errOrdine && (errOrdine.code === "PGRST204" || errOrdine.message?.includes("ordine"))) {
      const { data: dataNoOrdine, error } = await supabase
        .from("prodotto_ingrediente")
        .select("ingrediente_id")
        .eq("prodotto_id", productId)
        .eq("tenant_id", tenantId)
      if (error || !dataNoOrdine?.length) return []
      rows = dataNoOrdine
    } else if (errOrdine || !dataWithOrdine?.length) {
      return []
    } else {
      rows = dataWithOrdine
    }
    const ids = rows.map((r) => r.ingrediente_id).filter(Boolean)
    if (!ids.length) return []
    const fullCols = "id, nome, vaInCottura, va_in_cottura, costo_unitario, costo_abbondante, costo_senza, costo_poco"
    let { data: ingredients, error: err2 } = await supabase
      .from("Ingrediente")
      .select(fullCols)
      .eq("tenant_id", tenantId)
      .in("id", ids)
    if (err2 && (err2.code === "PGRST204" || err2.message?.includes("column"))) {
      const fallback = await supabase
        .from("Ingrediente")
        .select("id, nome, va_in_cottura, costo_unitario")
        .eq("tenant_id", tenantId)
        .in("id", ids)
      ingredients = fallback.data
      err2 = fallback.error
    }
    if (err2 || !ingredients?.length) return []
    const byId = new Map(ingredients.map((ing) => [ing.id, ing]))
    let ordered = ids.map((id) => byId.get(id)).filter(Boolean)
    if (rows[0] && rows[0].ordine === undefined) ordered = ordered.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
    return ordered.map((ing) => ({
      id: ing.id,
      nome: ing.nome ?? "",
      vaInCottura: ing.vaInCottura === true || ing.va_in_cottura === true,
      costo_unitario: ing.costo_unitario,
      costo_abbondante: ing.costo_abbondante,
      costo_senza: ing.costo_senza,
      costo_poco: ing.costo_poco,
    }))
  } catch (e) {
    console.warn("getProductIngredienti error:", e)
    return []
  }
}

function _toNum(v) {
  if (v === null || v === undefined || v === "") return 0
  const n = Number(String(v).replace(",", "."))
  return Number.isNaN(n) ? 0 : n
}

/**
 * Calcola il prezzo di un prodotto (base impasto + somma costi ingredienti).
 * Usare in Cassa/store quando il prezzo salvato non include gli ingredienti.
 */
export async function getProductPrezzoCalcolato(tenantId, productId) {
  if (!tenantId || !productId) return 0
  try {
    const [config, ings] = await Promise.all([
      getConfigurazioneCosti(tenantId),
      getProductIngredienti(tenantId, productId),
    ])
    const costoBase = _toNum(config?.costo_impasto ?? config?.costoImpasto) || 0
    let totalIng = 0
    for (const ing of ings || []) {
      totalIng += _toNum(ing.costo_unitario ?? ing.costoUnitario ?? ing.costo)
    }
    return costoBase + totalIng
  } catch (e) {
    console.warn("getProductPrezzoCalcolato error:", e)
    return 0
  }
}

/**
 * Arricchisce i prodotti con prezzo ricalcolato (base + ingredienti).
 * Utile in Cassa quando prezzo su Prodotto è solo base.
 */
export async function enrichProductsWithPrezzoCalcolato(tenantId, products) {
  if (!tenantId || !products?.length) return products || []
  try {
    const [config, allIng] = await Promise.all([
      getConfigurazioneCosti(tenantId),
      getIngredients(tenantId),
    ])
    const costoBase = _toNum(config?.costo_impasto ?? config?.costoImpasto) || 0
    const ingMap = new Map((allIng || []).map((i) => [i.id, i]))

    const out = []
    for (const p of products) {
      const ings = await getProductIngredienti(tenantId, p.id)
      let totalIng = 0
      for (const ing of ings || []) {
        totalIng += _toNum(ing.costo_unitario ?? ing.costoUnitario ?? ing.costo)
      }
      const hasIngredienti = (ings || []).length > 0
      const prezzoCalcolato = hasIngredienti ? costoBase + totalIng : 0
      const prezzoUsare = prezzoCalcolato > 0 ? prezzoCalcolato : _toNum(p.prezzo)
      out.push({ ...p, prezzo: prezzoUsare })
    }
    return out
  } catch (e) {
    console.warn("enrichProductsWithPrezzoCalcolato error:", e)
    return products || []
  }
}

/** Associa gli ingredienti a un prodotto (sostituisce quelli esistenti). L'ordine dell'array definisce l'ordine di uscita (menu/cottura).
 *  Richiede INSERT/DELETE su core.prodotto_ingrediente o trigger sulla vista. Esegui add_ordine_prodotto_ingrediente.sql + view aggiornata. */
export async function setProdottoIngredienti(tenantId, productId, ingredienteIds) {
  const { error: delErr } = await supabase
    .from("prodotto_ingrediente")
    .delete()
    .eq("prodotto_id", productId)
    .eq("tenant_id", tenantId)
  if (delErr) throw delErr
  if (!ingredienteIds?.length) return
  const rows = ingredienteIds.map((ingrediente_id, index) => ({
    tenant_id: tenantId,
    prodotto_id: productId,
    ingrediente_id,
    quantita: 1,
    ordine: index,
  }))
  let insErr = (await supabase.from("prodotto_ingrediente").insert(rows)).error
  if (insErr && (insErr.code === "PGRST204" || insErr.message?.includes("ordine"))) {
    const rowsNoOrdine = ingredienteIds.map((ingrediente_id) => ({
      tenant_id: tenantId,
      prodotto_id: productId,
      ingrediente_id,
      quantita: 1,
    }))
    insErr = (await supabase.from("prodotto_ingrediente").insert(rowsNoOrdine)).error
  }
  if (insErr) throw insErr
}

export async function createProduct(product) {
  const payload = { ...product }
  // Normalizza per la vista Prodotto: invia sempre snake_case (tenant_id, categoria_id)
  if (payload.tenantId !== undefined) {
    payload.tenant_id = payload.tenantId
    delete payload.tenantId
  }
  if (payload.categoriaId !== undefined) {
    payload.categoria_id = payload.categoriaId
    delete payload.categoriaId
  }
  if (payload.immagine_url === undefined && payload.imageUrl !== undefined) {
    payload.immagine_url = payload.imageUrl
    delete payload.imageUrl
  }
  if (payload.attivo !== undefined) delete payload.attivo
  // Per categorie senza ordine (bibite, dolci, fritti) default ordine 0
  if (payload.ordine === undefined) payload.ordine = 0

  const { data, error } = await supabase.from("Prodotto").insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(productId, updates) {
  const payload = { ...updates };
  // Vista Prodotto usa solo snake_case: rimuovi camelCase per evitare PGRST204
  if (payload.categoriaId !== undefined) {
    payload.categoria_id = payload.categoria_id ?? payload.categoriaId;
  }
  delete payload.categoriaId;
  const { error } = await supabase
    .from("Prodotto")
    .update(payload)
    .eq("id", productId)

  if (error) throw error
}

export async function toggleProductActive(productId, attivo) {
  const { error } = await supabase
    .from("Prodotto")
    .update({ attivo })
    .eq("id", productId)

  if (error) throw error
}

export async function deleteProduct(productId) {
  const { error } = await supabase
    .from("Prodotto")
    .delete()
    .eq("id", productId)

  if (error) throw error
}

/** Converte valore prezzo (accetta virgola decimale) in numero */
function toNum(v) {
  if (v === null || v === undefined || v === "") return 0
  const n = Number(String(v).replace(",", "."))
  return Number.isNaN(n) ? 0 : n
}

/**
 * Ricalcola e aggiorna il prezzo di tutte le pizze in base a costo base (impasto) e costi ingredienti.
 * Da chiamare dopo modifiche a ingredienti o a configurazione costi (costo_impasto).
 * Considera solo prodotti in categorie "pizze" (escluse fritti, dolci, bibite).
 */
export async function recalculateAllPizzaPrices(tenantId) {
  if (!tenantId) return
  const excludeSlugs = new Set(["fritti", "dolci", "bibite"])
  const [categories, products, config, allIngredients] = await Promise.all([
    getCategories(tenantId),
    getProducts(tenantId),
    getConfigurazioneCosti(tenantId),
    getIngredients(tenantId),
  ])
  const allowedCategoryIds = new Set(
    (categories || []).filter((c) => !excludeSlugs.has((c.slug || "").toLowerCase())).map((c) => c.id)
  )
  const pizze = (products || []).filter((p) => {
    const cid = p.categoria_id ?? p.categoriaId
    return !cid || allowedCategoryIds.has(cid)
  })
  const costoBase = toNum(config?.costo_impasto ?? config?.costoImpasto) || 0
  const ingMap = new Map((allIngredients || []).map((i) => [i.id, i]))

  for (const product of pizze) {
    const ings = await getProductIngredienti(tenantId, product.id)
    let totalIng = 0
    for (const ing of ings) {
      const cost = toNum(ing.costo_unitario ?? ing.costoUnitario ?? ing.costo)
      totalIng += cost
    }
    const newPrezzo = costoBase + totalIng
    await updateProduct(product.id, { prezzo: newPrezzo })
  }
}

///////////////////////////////////////////////////////////
// ===================== REPORTS ========================
///////////////////////////////////////////////////////////

export async function getOrdersByDateRange(
  tenantId,
  startDate,
  endDate
) {
  let q = supabase
    .from("Ordine")
    .select("*")
    .eq("tenantId", tenantId)
  if (startDate != null) q = q.gte("createdAt", startDate)
  if (endDate != null) q = q.lte("createdAt", endDate)
  const { data, error } = await q.order("createdAt", { ascending: false })

  if (error) throw error
  return data || []
}

function getDefaultReportRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Categorie da escludere dalla classifica vendite (solo prodotti “ingrediente”, non pizze/bibite/ecc.). */
function isIngredientCategoryForReport(cat) {
  if (!cat) return false
  const slug = (cat.slug || "").toLowerCase().trim()
  const nome = (cat.nome || "").toLowerCase().trim()
  if (slug === "ingredienti" || slug === "ingrediente") return true
  if (nome === "ingredienti" || nome === "ingrediente") return true
  if (nome.includes("ingredient") && !nome.includes("pizza")) return true
  return false
}

/**
 * Top N prodotti venduti (per nome prodotto + formato), esclude righe la cui categoria è “ingredienti”.
 */
async function computeTopProdottiVenduti(tenantId, ordineIds, topN = 5) {
  if (!tenantId || !ordineIds?.length) return []

  let righe
  try {
    righe = await getRigheByOrdineIds(ordineIds)
  } catch (e) {
    console.warn("computeTopProdottiVenduti righe:", e)
    return []
  }
  if (!righe?.length) return []

  const productIds = [...new Set(righe.map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean))]
  if (!productIds.length) return []

  let prodottiRows = []
  try {
    const { data, error } = await supabase
      .from("Prodotto")
      .select("id, nome, categoria_id")
      .eq("tenant_id", tenantId)
      .in("id", productIds)
    if (error) throw error
    prodottiRows = data || []
  } catch (e) {
    console.warn("computeTopProdottiVenduti prodotti:", e)
    return []
  }

  let categorie = []
  try {
    categorie = await getCategories(tenantId)
  } catch {
    categorie = []
  }
  const catById = {}
  for (const c of categorie) {
    catById[c.id] = c
  }

  const byId = {}
  for (const p of prodottiRows) {
    byId[p.id] = p
  }

  const counts = new Map()

  for (const r of righe) {
    const pid = r.prodottoId ?? r.prodotto_id
    if (!pid) continue
    const p = byId[pid]
    if (!p) continue
    const cid = p.categoria_id ?? p.categoriaId
    const cat = cid ? catById[cid] : null
    if (isIngredientCategoryForReport(cat)) continue

    const formatoNome = r.formatoNome ?? r.formato_nome
    const baseNome = (p.nome || "Prodotto").trim()
    const label = formatoNome ? `${baseNome} (${formatoNome})` : baseNome
    const q = Number(r.quantita) || 0
    counts.set(label, (counts.get(label) || 0) + q)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([nome, quantita]) => ({ nome, quantita }))
}

export async function getReportData(
  tenantId,
  startDate,
  endDate
) {
  const range = (startDate != null && endDate != null)
    ? { start: startDate, end: endDate }
    : getDefaultReportRange()
  const orders = await getOrdersByDateRange(
    tenantId,
    range.start,
    range.end
  )

  const totalOrders = orders.length

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.totale ?? order.total ?? 0),
    0
  )

  const ordineIds = orders.map((o) => o.id).filter(Boolean)
  const topProdotti = await computeTopProdottiVenduti(tenantId, ordineIds, 5)
  const topProdotto = topProdotti[0]?.nome ?? "-"

  return {
    orders,
    totalOrders,
    totalRevenue,
    totaleOrdini: totalOrders,
    fatturato: totalRevenue,
    topProdotti,
    topProdotto,
  }
}

///////////////////////////////////////////////////////////
// ===================== TENANT SETTINGS ================
///////////////////////////////////////////////////////////

export async function getTenantSettings(tenantId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single()

  if (error) throw error
  return data
}

export async function updateTenantSettings(tenantId, updates) {
  const payload = { ...updates }
  const optional = ["indirizzo", "telefono", "email", "lat", "lng", "logo_url", "orari_settimana", "parametri_operativi"]
  const { error } = await supabase.from("tenants").update(payload).eq("id", tenantId)
  if (error) {
    if (error.code === "PGRST204") {
      for (const key of optional) delete payload[key]
      const retry = await supabase.from("tenants").update(payload).eq("id", tenantId)
      if (retry.error) throw retry.error
      return
    }
    throw error
  }
}