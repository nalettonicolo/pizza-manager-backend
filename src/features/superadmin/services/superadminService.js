import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/utils/logSupabaseError";

const SCHEMA_CORE = "core";

/**
 * Usa lo schema `core` solo se abilitato in build E esposto in Supabase (Settings → API → Exposed schemas).
 * Altrimenti `supabase.schema("core")` genera: "The schema must be one of the following: public, graphql_public".
 */
const USE_CORE_SCHEMA = import.meta.env.VITE_SUPABASE_USE_CORE_SCHEMA === "true";

function isSchemaNotExposedError(err) {
  const m = String(err?.message ?? err ?? "");
  return /schema must be one of/i.test(m);
}

/** Colonna assente / cache PostgREST non aggiornata dopo migrazione SQL. */
function isMissingColumnOrSchemaCacheError(err) {
  const m = String(err?.message ?? err ?? "");
  const code = err?.code;
  return (
    code === "PGRST204" ||
    /could not find.*column/i.test(m) ||
    /schema cache/i.test(m)
  );
}

/** Vista public.tenants con CASE su piano: UPDATE su piano fallisce (0A000). */
function isPianoNotUpdatableOnView(err) {
  return err?.code === "0A000" && /piano/i.test(String(err?.message ?? ""));
}

/** Aggiorna solo `piano` su admin.tenants (richiede schema admin esposto in PostgREST). */
async function updatePianoOnAdminTable(id, piano) {
  const admin = supabase.schema("admin");
  const { error } = await admin.from("tenants").update({ piano }).eq("id", id);
  if (!error) return true;
  if (isSchemaNotExposedError(error)) return false;
  console.warn("[superadmin] update piano su admin.tenants:", error.message ?? error);
  return false;
}

/** Solo campi presenti su tenant “minimi” (senza colonne fatturazione). */
function tenantRowMinimal(payload) {
  return {
    nome: payload.nome,
    slug: payload.slug,
    piano: payload.piano ?? "TRIAL",
    attivo: payload.attivo ?? true,
  };
}

/**
 * Query builder per `core.<table>` oppure `null` se il fallback core è disattivo.
 */
function fromCore(table) {
  if (!USE_CORE_SCHEMA) return null;
  return supabase.schema(SCHEMA_CORE).from(table);
}

const TENANT_SELECT_FULL =
  "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at, " +
  "partita_iva, email_fatturazione, pec, codice_univoco_sdi, " +
  "addebito_automatico_mensile, data_attivazione_abbonamento, sconto_percentuale, prova_valida_fino";

const TENANT_SELECT_LEGACY = "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at";

async function fetchTenantsList(selectCols) {
  const q = supabase.from("tenants").select(selectCols).is("deleted_at", null).order("created_at", { ascending: false });
  const { data, error } = await q;
  if (!error) return data ?? [];
  logSupabaseError("superadmin.fetchTenantsList", error, { selectCols });
  const core = fromCore("tenants");
  if (!core) throw error;
  const res = await core.select(selectCols).is("deleted_at", null).order("created_at", { ascending: false });
  if (!res.error) return res.data ?? [];
  logSupabaseError("superadmin.fetchTenantsList.core", res.error, { selectCols });
  if (isSchemaNotExposedError(res.error)) throw error;
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
  logSupabaseError("superadmin.getTenant", error, { id });
  const core = fromCore("tenants");
  if (!core) throw error;
  const res = await core.select("*").eq("id", id).is("deleted_at", null).single();
  if (res.error) {
    logSupabaseError("superadmin.getTenant.core", res.error, { id });
    if (isSchemaNotExposedError(res.error)) throw error;
    throw res.error;
  }
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
    prova_valida_fino:
      payload.prova_valida_fino === "" || payload.prova_valida_fino == null
        ? null
        : payload.prova_valida_fino,
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
  const subCore = fromCore("subscriptions");
  if (!subCore) {
    console.warn("subscriptions upsert (solo public):", r.error?.message ?? r.error);
    return;
  }
  r = await subCore.upsert(subRow, opts).select().single();
  if (r.error) {
    if (isSchemaNotExposedError(r.error)) {
      console.warn("subscriptions upsert: schema core non disponibile, ignorato");
      return;
    }
    console.warn("subscriptions upsert:", r.error.message ?? r.error);
  }
}

export async function createTenant(payload) {
  const row = tenantRowFromPayload(payload);
  let { data, error } = await supabase.from("tenants").insert(row).select().single();
  let created = data;
  if (error && isMissingColumnOrSchemaCacheError(error)) {
    const retry = await supabase.from("tenants").insert(tenantRowMinimal(payload)).select().single();
    if (!retry.error) {
      created = retry.data;
      error = null;
    } else {
      error = retry.error;
    }
  }
  if (error) {
    logSupabaseError("superadmin.createTenant", error, { nome: payload?.nome, slug: payload?.slug });
    const core = fromCore("tenants");
    if (!core) throw error;
    let res = await core.insert(row).select().single();
    if (res.error && isMissingColumnOrSchemaCacheError(res.error)) {
      res = await core.insert(tenantRowMinimal(payload)).select().single();
    }
    if (res.error) {
      if (isSchemaNotExposedError(res.error)) throw error;
      throw res.error;
    }
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
  let { error } = await supabase.from("tenants").update(row).eq("id", id);

  if (error && isPianoNotUpdatableOnView(error)) {
    const { piano, ...rest } = row;
    const r1 = await supabase.from("tenants").update(rest).eq("id", id);
    if (!r1.error) {
      error = null;
      if (piano !== undefined) {
        const ok = await updatePianoOnAdminTable(id, piano);
        if (!ok) {
          console.warn(
            "[superadmin] Piano non aggiornabile sulla vista: applica migrazione SQL public.tenants (SELECT * FROM admin.tenants) oppure espone lo schema admin in Supabase → API."
          );
        }
      }
    } else {
      error = r1.error;
    }
  }

  if (error && isMissingColumnOrSchemaCacheError(error)) {
    const retry = await supabase.from("tenants").update(tenantRowMinimal(updates)).eq("id", id);
    if (!retry.error) {
      error = null;
    } else {
      error = retry.error;
    }
  }
  if (error) {
    logSupabaseError("superadmin.updateTenant", error, { id });
    const core = fromCore("tenants");
    if (!core) throw error;
    let res = await core.update(row).eq("id", id);
    if (res.error && isMissingColumnOrSchemaCacheError(res.error)) {
      res = await core.update(tenantRowMinimal(updates)).eq("id", id);
    }
    if (res.error) {
      if (isSchemaNotExposedError(res.error)) throw error;
      throw res.error;
    }
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
    const subCore = fromCore("subscriptions");
    if (!subCore) return [];
    const coreQ = await subCore.select(cols).order("created_at", order);
    if (coreQ.error) {
      if (isSchemaNotExposedError(coreQ.error)) return [];
      return [];
    }
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
      const subCore = fromCore("subscriptions");
      if (subCore) {
        const coreAgain = await subCore.select(cols).order("created_at", order);
        if (!coreAgain.error && coreAgain.data?.length) rows = coreAgain.data;
      }
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
