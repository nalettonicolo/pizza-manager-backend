import { supabase } from "@/lib/supabaseClient";

const SCHEMA_CORE = "core";

/**
 * Restituisce il client Supabase per le tabelle nello schema core (se necessario).
 * Prova prima public (tenants/subscriptions), poi core.
 */
function fromCore(table) {
  try {
    return supabase.schema(SCHEMA_CORE).from(table);
  } catch {
    return supabase.from(table);
  }
}

const TENANT_SELECT_FULL =
  "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at, " +
  "partita_iva, email_fatturazione, pec, codice_univoco_sdi, " +
  "addebito_automatico_mensile, data_attivazione_abbonamento, sconto_percentuale";

const TENANT_SELECT_LEGACY = "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at";

async function fetchTenantsList(selectCols) {
  const q = supabase.from("tenants").select(selectCols).is("deleted_at", null).order("created_at", { ascending: false });
  const { data, error } = await q;
  if (!error) return data ?? [];
  const coreQ = fromCore("tenants").select(selectCols).is("deleted_at", null).order("created_at", { ascending: false });
  const res = await coreQ;
  if (!res.error) return res.data ?? [];
  throw res.error;
}

/**
 * Elenco di tutti i tenant (solo superadmin).
 */
export async function getTenants() {
  try {
    return await fetchTenantsList(TENANT_SELECT_FULL);
  } catch {
    return fetchTenantsList(TENANT_SELECT_LEGACY);
  }
}

/**
 * Dettaglio singolo tenant.
 */
export async function getTenant(id) {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!error) return data;
  const res = await fromCore("tenants").select("*").eq("id", id).is("deleted_at", null).single();
  if (res.error) throw res.error;
  return res.data;
}

/**
 * Crea un nuovo tenant.
 */
function tenantRowFromPayload(payload) {
  const base = {
    nome: payload.nome,
    slug: payload.slug,
    piano: payload.piano ?? "TRIAL",
    attivo: payload.attivo ?? true,
    partita_iva: payload.partita_iva?.trim() || null,
    email_fatturazione: payload.email_fatturazione?.trim() || null,
    pec: payload.pec?.trim() || null,
    codice_univoco_sdi: payload.codice_univoco_sdi?.trim() || null,
    addebito_automatico_mensile: !!payload.addebito_automatico_mensile,
    data_attivazione_abbonamento: payload.data_attivazione_abbonamento || null,
    sconto_percentuale:
      payload.sconto_percentuale === "" || payload.sconto_percentuale == null
        ? 0
        : Math.min(100, Math.max(0, Number(payload.sconto_percentuale) || 0)),
  };
  return base;
}

/** Piano UI → valore enum DB (core.piano_saas: FREE, PRO, ENTERPRISE) */
function pianoToDbEnum(piano) {
  const p = String(piano ?? "TRIAL").toUpperCase();
  if (p === "TRIAL" || p === "FREE") return "FREE";
  if (p === "PRO") return "PRO";
  if (p === "ENTERPRISE") return "ENTERPRISE";
  return "FREE";
}

/** Prossima data rinnovo (primo giorno del mese successivo alla data di riferimento, mezzogiorno UTC). */
function computeRinnovoIl(dataAttivazione) {
  if (!dataAttivazione) return null;
  const base = new Date(dataAttivazione);
  if (Number.isNaN(base.getTime())) return null;
  const y = base.getFullYear();
  const m = base.getMonth();
  return new Date(Date.UTC(y, m + 1, 1, 12, 0, 0)).toISOString();
}

async function upsertSubscriptionForTenant(tenantRow, payload) {
  const tenantId = tenantRow?.id;
  if (!tenantId) return;
  const piano = pianoToDbEnum(payload?.piano ?? tenantRow?.piano);
  const rinnovo = computeRinnovoIl(payload?.data_attivazione_abbonamento ?? tenantRow?.data_attivazione_abbonamento);

  const subRow = {
    tenant_id: tenantId,
    piano,
    stato: "ATTIVA",
    rinnovo_il: rinnovo,
  };

  const opts = { onConflict: "tenant_id" };
  let r = await supabase.from("subscriptions").upsert(subRow, opts).select().single();
  if (!r.error) return;
  r = await fromCore("subscriptions").upsert(subRow, opts).select().single();
  if (r.error) {
    console.warn("subscriptions upsert:", r.error.message ?? r.error);
  }
}

export async function createTenant(payload) {
  const row = tenantRowFromPayload(payload);
  const { data, error } = await supabase.from("tenants").insert(row).select().single();
  let created = data;
  if (error) {
    const res = await fromCore("tenants").insert(row).select().single();
    if (res.error) throw res.error;
    created = res.data;
  }
  await upsertSubscriptionForTenant(created, payload).catch(() => {});
  return created;
}

/**
 * Aggiorna un tenant.
 */
export async function updateTenant(id, updates) {
  const row = tenantRowFromPayload(updates);
  const { error } = await supabase.from("tenants").update(row).eq("id", id);
  if (error) {
    const res = await fromCore("tenants").update(row).eq("id", id);
    if (res.error) throw res.error;
  }
  await upsertSubscriptionForTenant({ id, ...row }, updates).catch(() => {});
}

/**
 * Elenco subscription con nome tenant (solo superadmin).
 * Prova `public.subscriptions`, poi `core.subscriptions` (schema enterprise nelle migrazioni).
 * In Supabase Dashboard → Settings → API, lo schema `core` deve essere tra gli "Exposed schemas"
 * affinché PostgREST serva le tabelle core.
 */
export async function getSubscriptions() {
  const cols = "id, tenant_id, piano, stato, rinnovo_il, created_at, updated_at";
  const order = { ascending: false };

  let list = null;
  const pub = await supabase.from("subscriptions").select(cols).order("created_at", order);
  if (!pub.error) {
    list = pub.data;
  } else {
    const coreQ = await fromCore("subscriptions").select(cols).order("created_at", order);
    if (coreQ.error) return [];
    list = coreQ.data;
  }

  let rows = list ?? [];

  const tenants = await getTenants();
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const subTenantIds = new Set(rows.map((s) => s.tenant_id));

  /** Crea righe subscription mancanti (tenant senza record) così la pagina Abbonamenti è allineata ai clienti. */
  const missing = tenants.filter((t) => t.id && !subTenantIds.has(t.id));
  for (const t of missing) {
    await upsertSubscriptionForTenant(t, t).catch(() => {});
  }
  if (missing.length > 0) {
    const again = await supabase.from("subscriptions").select(cols).order("created_at", order);
    if (!again.error && again.data?.length) {
      rows = again.data;
    } else {
      const coreAgain = await fromCore("subscriptions").select(cols).order("created_at", order);
      if (!coreAgain.error && coreAgain.data?.length) rows = coreAgain.data;
    }
  }

  const enriched = rows.map((s) => {
    const t = tenantMap[s.tenant_id];
    return {
      ...s,
      tenant_nome: t?.nome ?? "—",
      tenant_slug: t?.slug ?? "—",
      rinnovo_automatico: !!t?.addebito_automatico_mensile,
      data_attivazione_abbonamento: t?.data_attivazione_abbonamento ?? null,
    };
  });

  /** Se non esiste alcuna riga in subscriptions (es. policy RLS che blocca insert), mostra comunque i clienti come righe derivate dal tenant. */
  if (enriched.length === 0 && tenants.length > 0) {
    return tenants.map((t) => ({
      id: `tenant-${t.id}`,
      tenant_id: t.id,
      piano: pianoToDbEnum(t.piano),
      stato: "ATTIVA",
      rinnovo_il: computeRinnovoIl(t.data_attivazione_abbonamento),
      created_at: t.created_at ?? null,
      updated_at: t.updated_at ?? null,
      tenant_nome: t.nome ?? "—",
      tenant_slug: t.slug ?? "—",
      rinnovo_automatico: !!t.addebito_automatico_mensile,
      data_attivazione_abbonamento: t.data_attivazione_abbonamento ?? null,
      _fromTenantOnly: true,
    }));
  }

  return enriched;
}

/**
 * Statistiche piattaforma per la dashboard superadmin.
 */
export async function getPlatformStats() {
  const [tenants, subs, ordersCountRes] = await Promise.all([
    getTenants(),
    getSubscriptions().catch(() => []),
    supabase.from("Ordine").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0).catch(() => 0),
  ]);
  const totalOrders = typeof ordersCountRes === "number" ? ordersCountRes : 0;

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.attivo).length;
  const byPlan = tenants.reduce((acc, t) => {
    const p = t.piano ?? "TRIAL";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const subsByStato = (subs || []).reduce((acc, s) => {
    const st = s.stato ?? "ATTIVA";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  return {
    totalTenants,
    activeTenants,
    byPlan,
    subsByStato,
    totalSubscriptions: (subs || []).length,
    totalOrders,
    recentTenants: tenants.slice(0, 5),
  };
}
