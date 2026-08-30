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

/** Tabella assente in PostgREST (es. solo core.subscriptions, niente public.subscriptions). */
function isTableNotInSchemaCacheError(err) {
  const m = String(err?.message ?? err ?? "");
  const code = String(err?.code ?? "");
  const status = Number(err?.status ?? 0);
  return (
    /could not find the table/i.test(m) ||
    /relation .* does not exist/i.test(m) ||
    code === "PGRST205" ||
    code === "42P01" ||
    status === 404
  );
}

/** Colonna assente / cache PostgREST non aggiornata dopo migrazione SQL (non usare per “table not found”). */
function isMissingColumnOrSchemaCacheError(err) {
  if (isTableNotInSchemaCacheError(err)) return false;
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
  const row = {
    nome: payload.nome,
    slug: payload.slug,
    piano: payload.piano ?? "TRIAL",
    attivo: payload.attivo ?? true,
  };
  if (payload.parametri_operativi != null && typeof payload.parametri_operativi === "object") {
    row.parametri_operativi = payload.parametri_operativi;
  }
  return row;
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
  "addebito_automatico_mensile, data_attivazione_abbonamento, sconto_percentuale, sconto_scadenza, prova_valida_fino, " +
  "public_domain, public_domain_status, public_domain_requested_at, sito_web_cliente, parametri_operativi";

/** Come FULL ma senza sito_web_cliente (DB non ancora migrato). */
const TENANT_SELECT_NO_SITO_WEB =
  "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at, " +
  "partita_iva, email_fatturazione, pec, codice_univoco_sdi, " +
  "addebito_automatico_mensile, data_attivazione_abbonamento, sconto_percentuale, sconto_scadenza, prova_valida_fino, " +
  "public_domain, public_domain_status, public_domain_requested_at, parametri_operativi";

const TENANT_SELECT_LEGACY = "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at";

const TENANT_SELECT_CACHE_KEY = "sa_tenants_select_cache_v1";
const SUBSCRIPTIONS_PUBLIC_KEY = "sa_public_subscriptions_available_v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorage(key) {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota/privacy mode */
  }
}

let TENANT_SELECT_CACHE = (() => {
  const v = readStorage(TENANT_SELECT_CACHE_KEY);
  if (v === TENANT_SELECT_FULL || v === TENANT_SELECT_NO_SITO_WEB || v === TENANT_SELECT_LEGACY) return v;
  // Default conservativo: evita 400 quando la view public.tenants non espone tutte le colonne.
  return TENANT_SELECT_LEGACY;
})();

let PUBLIC_SUBSCRIPTIONS_AVAILABLE = (() => {
  const v = readStorage(SUBSCRIPTIONS_PUBLIC_KEY);
  if (v === "true") return true;
  if (v === "false") return false;
  return true;
})();

/** Log per ogni tentativo fallito (solo dev o con VITE_DEBUG_SUPABASE=true). In produzione i fallback select sono attesi. */
const VERBOSE_TENANTS_LIST =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_SUPABASE === "true";

async function fetchTenantsList(selectCols, { quiet = false } = {}) {
  const q = supabase.from("tenants").select(selectCols).is("deleted_at", null).order("created_at", { ascending: false });
  const { data, error } = await q;
  if (!error) return data ?? [];
  if (!quiet) {
    logSupabaseError("superadmin.fetchTenantsList", error, { selectCols });
  }
  const core = fromCore("tenants");
  if (!core) throw error;
  const res = await core.select(selectCols).is("deleted_at", null).order("created_at", { ascending: false });
  if (!res.error) return res.data ?? [];
  if (!quiet) {
    logSupabaseError("superadmin.fetchTenantsList.core", res.error, { selectCols });
  }
  if (isSchemaNotExposedError(res.error)) throw error;
  throw res.error;
}

/**
 * Elenco di tutti i tenant (solo superadmin).
 */
export async function getTenants() {
  const attempts = [TENANT_SELECT_CACHE, TENANT_SELECT_FULL, TENANT_SELECT_NO_SITO_WEB, TENANT_SELECT_LEGACY].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );
  const quiet = !VERBOSE_TENANTS_LIST;
  let lastErr = null;
  for (const cols of attempts) {
    try {
      const rows = await fetchTenantsList(cols, { quiet });
      TENANT_SELECT_CACHE = cols;
      writeStorage(TENANT_SELECT_CACHE_KEY, cols);
      return rows;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) {
    logSupabaseError("superadmin.getTenants", lastErr, { attempts: attempts.length });
  }
  return [];
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
    sconto_scadenza:
      payload.sconto_scadenza === "" || payload.sconto_scadenza == null ? null : payload.sconto_scadenza,
    prova_valida_fino:
      payload.prova_valida_fino === "" || payload.prova_valida_fino == null
        ? null
        : payload.prova_valida_fino,
    public_domain:
      payload.public_domain === undefined
        ? undefined
        : payload.public_domain?.trim()
          ? payload.public_domain.trim()
          : null,
    public_domain_status: payload.public_domain_status,
    public_domain_requested_at: payload.public_domain_requested_at,
  };
  const cleaned = { ...base };
  if (cleaned.public_domain === undefined) delete cleaned.public_domain;
  if (cleaned.public_domain_status === undefined) delete cleaned.public_domain_status;
  if (cleaned.public_domain_requested_at === undefined) delete cleaned.public_domain_requested_at;
  if (Object.prototype.hasOwnProperty.call(payload, "sito_web_cliente")) {
    cleaned.sito_web_cliente =
      payload.sito_web_cliente == null || String(payload.sito_web_cliente).trim() === ""
        ? null
        : String(payload.sito_web_cliente).trim();
  }
  if (cleaned.sito_web_cliente === undefined) delete cleaned.sito_web_cliente;
  if (Object.prototype.hasOwnProperty.call(payload, "parametri_operativi")) {
    const po = payload.parametri_operativi;
    if (po != null && typeof po === "object") {
      cleaned.parametri_operativi = po;
    }
  }
  return cleaned;
}

/** Aggiorna solo campi pubblicazione / dominio (senza toccare nome, slug, piano). */
export async function updateTenantPublicDomain(id, patch) {
  const row = {};
  if (patch.public_domain !== undefined) {
    row.public_domain = patch.public_domain?.trim() ? patch.public_domain.trim() : null;
  }
  if (patch.public_domain_status !== undefined) row.public_domain_status = patch.public_domain_status;
  if (patch.public_domain_requested_at !== undefined) row.public_domain_requested_at = patch.public_domain_requested_at;
  if (patch.sito_web_cliente !== undefined) {
    row.sito_web_cliente =
      patch.sito_web_cliente == null || String(patch.sito_web_cliente).trim() === ""
        ? null
        : String(patch.sito_web_cliente).trim();
  }
  if (Object.keys(row).length === 0) return;
  let { error } = await supabase.from("tenants").update(row).eq("id", id);
  if (!error) return;

  if (isMissingColumnOrSchemaCacheError(error)) {
    const details = String(error.details || error.message || "");
    const retryRow = { ...row };
    if (/\bsito_web_cliente\b/i.test(details)) delete retryRow.sito_web_cliente;
    if (/\bpublic_domain\b/i.test(details)) delete retryRow.public_domain;
    if (/\bpublic_domain_status\b/i.test(details)) delete retryRow.public_domain_status;
    if (/\bpublic_domain_requested_at\b/i.test(details)) delete retryRow.public_domain_requested_at;
    if (Object.keys(retryRow).length > 0) {
      const retry = await supabase.from("tenants").update(retryRow).eq("id", id);
      error = retry.error;
      if (!error) return;
    }
  }
  logSupabaseError("superadmin.updateTenantPublicDomain", error, { id });
  throw error;
}

/** Checklist go-live condivisa (RPC Super Admin). */
export async function getGoLiveChecklist(tenantId) {
  if (!tenantId) return null
  const { data, error } = await supabase.rpc("sa_get_go_live_checklist", { p_tenant_id: tenantId })
  if (error) {
    logSupabaseError("superadmin.getGoLiveChecklist", error, { tenantId })
    throw error
  }
  return data && typeof data === "object" ? data : null
}

export async function upsertGoLiveChecklist(tenantId, checks) {
  if (!tenantId) throw new Error("tenant obbligatorio")
  const { data, error } = await supabase.rpc("sa_upsert_go_live_checklist", {
    p_tenant_id: tenantId,
    p_checks: checks || {},
  })
  if (error) {
    logSupabaseError("superadmin.upsertGoLiveChecklist", error, { tenantId })
    throw error
  }
  return data
}

/** Piano UI → valore enum DB (core.piano_saas: FREE, PRO, ENTERPRISE) */
function pianoToDbEnum(piano) {
  const p = String(piano ?? "TRIAL").toUpperCase();
  if (p === "TRIAL" || p === "FREE") return "FREE";
  if (p === "PRO") return "PRO";
  if (p === "ENTERPRISE") return "ENTERPRISE";
  return "FREE";
}

/** Ciclo fatturazione: 365 = annuale, altrimenti 30 (mensile). */
function parseAbbonamentoCicloGiorni(payload, tenantRow) {
  const raw =
    payload?.abbonamento_ciclo_giorni ??
    payload?.abbonamentoCicloGiorni ??
    tenantRow?.abbonamento_ciclo_giorni;
  const n = Number(raw);
  if (n === 365) return 365;
  return 30;
}

/** Sconto % sul totale annuale (solo se ciclo 365). */
function parseScontoAnnualePercent(payload, tenantRow, cicloGiorni) {
  if (cicloGiorni !== 365) return null;
  const raw =
    payload?.abbonamento_sconto_annuale_percent ?? payload?.abbonamentoScontoAnnualePercent ?? tenantRow?.abbonamento_sconto_annuale_percent;
  const x = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(x) || x <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(x * 100) / 100));
}

/**
 * Aggiunge N mesi di calendario a una data YYYY-MM-DD (mezzogiorno UTC).
 * Il giorno viene ridotto se il mese di destinazione è più corto (es. 31 gen → 28/29 feb).
 */
function addCalendarMonthsFromDateStr(dateStr, monthsToAdd) {
  if (!dateStr || monthsToAdd < 1) return null;
  const s = String(dateStr).trim().slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return null;
  let y = Number(parts[0]);
  let mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  mo -= 1;
  mo += monthsToAdd;
  y += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(y, mo, day, 12, 0, 0, 0)).toISOString();
}

/**
 * Prossimo rinnovo da data attivazione.
 * `ciclo_fatturazione_giorni` in DB: 30 = un mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).
 */
function computeProssimoRinnovoIl(dataAttivazione, cicloGiorni) {
  const months = Number(cicloGiorni) === 365 ? 12 : 1;
  return addCalendarMonthsFromDateStr(dataAttivazione, months);
}

async function upsertSubscriptionRow(subRow, opts) {
  let r = { error: { status: 404 } };
  if (PUBLIC_SUBSCRIPTIONS_AVAILABLE) {
    r = await supabase.from("subscriptions").upsert(subRow, opts).select().single();
    if (isTableNotInSchemaCacheError(r.error)) {
      PUBLIC_SUBSCRIPTIONS_AVAILABLE = false;
      writeStorage(SUBSCRIPTIONS_PUBLIC_KEY, "false");
    }
  }
  if (!r.error) return;

  if (isTableNotInSchemaCacheError(r.error)) {
    PUBLIC_SUBSCRIPTIONS_AVAILABLE = false;
    writeStorage(SUBSCRIPTIONS_PUBLIC_KEY, "false");
    const subCoreOnly = fromCore("subscriptions");
    if (subCoreOnly) {
      let rc = await subCoreOnly.upsert(subRow, opts).select().single();
      if (!rc.error) return;
      if (isMissingColumnOrSchemaCacheError(rc.error) && (subRow.ciclo_fatturazione_giorni !== undefined || subRow.sconto_annuale_percent !== undefined)) {
        const { ciclo_fatturazione_giorni: _c0, sconto_annuale_percent: _s0, ...leg0 } = subRow;
        rc = await subCoreOnly.upsert(leg0, opts).select().single();
        if (!rc.error) return;
      }
    }
    return;
  }

  if (isMissingColumnOrSchemaCacheError(r.error) && (subRow.ciclo_fatturazione_giorni !== undefined || subRow.sconto_annuale_percent !== undefined)) {
    const { ciclo_fatturazione_giorni: _c, sconto_annuale_percent: _s, ...legacy } = subRow;
    r = await supabase.from("subscriptions").upsert(legacy, opts).select().single();
    if (!r.error) {
      console.warn("[superadmin] subscriptions: colonne ciclo/sconto assenti, salvataggio senza estensione annuale. Esegui la migrazione SQL.");
      return;
    }
  }
  const subCore = fromCore("subscriptions");
  if (!subCore) {
    if (!isTableNotInSchemaCacheError(r.error)) {
      console.warn("subscriptions upsert (solo public):", r.error?.message ?? r.error);
    }
    return;
  }
  r = await subCore.upsert(subRow, opts).select().single();
  if (!r.error) return;
  if (isMissingColumnOrSchemaCacheError(r.error) && (subRow.ciclo_fatturazione_giorni !== undefined || subRow.sconto_annuale_percent !== undefined)) {
    const { ciclo_fatturazione_giorni: _c2, sconto_annuale_percent: _s2, ...legacy2 } = subRow;
    r = await subCore.upsert(legacy2, opts).select().single();
    if (!r.error) {
      console.warn("[superadmin] subscriptions (core): colonne ciclo/sconto assenti, salvataggio senza estensione annuale.");
      return;
    }
  }
  if (r.error) {
    if (isSchemaNotExposedError(r.error)) {
      console.warn("subscriptions upsert: schema core non disponibile, ignorato");
      return;
    }
    console.warn("subscriptions upsert:", r.error.message ?? r.error);
  }
}

async function upsertSubscriptionForTenant(tenantRow, payload) {
  const tenantId = tenantRow?.id;
  if (!tenantId) return;
  const piano = pianoToDbEnum(payload?.piano ?? tenantRow?.piano);
  const ciclo = parseAbbonamentoCicloGiorni(payload, tenantRow);
  const sconto = parseScontoAnnualePercent(payload, tenantRow, ciclo);
  const dataAtt = payload?.data_attivazione_abbonamento ?? tenantRow?.data_attivazione_abbonamento;
  const rinnovo = computeProssimoRinnovoIl(dataAtt, ciclo);

  const subRow = {
    tenant_id: tenantId,
    piano,
    stato: "ATTIVA",
    rinnovo_il: rinnovo,
    ciclo_fatturazione_giorni: ciclo,
    sconto_annuale_percent: sconto,
  };

  const opts = { onConflict: "tenant_id" };
  await upsertSubscriptionRow(subRow, opts);
}

/**
 * Riga subscription per tenant (modale Clienti: ciclo e sconto annuale).
 */
export async function getSubscriptionRow(tenantId) {
  if (!tenantId) return null;
  const colsFull = "tenant_id, ciclo_fatturazione_giorni, sconto_annuale_percent, rinnovo_il";
  const colsLegacy = "tenant_id, rinnovo_il";

  const tryTable = async (getBuilder) => {
    let r = await getBuilder().select(colsFull).eq("tenant_id", tenantId).maybeSingle();
    if (!r.error && r.data) return r.data;
    if (isTableNotInSchemaCacheError(r.error)) return null;
    if (isMissingColumnOrSchemaCacheError(r.error)) {
      r = await getBuilder().select(colsLegacy).eq("tenant_id", tenantId).maybeSingle();
      if (!r.error && r.data) {
        return { ...r.data, ciclo_fatturazione_giorni: 30, sconto_annuale_percent: null };
      }
    }
    return null;
  };

  const pub = PUBLIC_SUBSCRIPTIONS_AVAILABLE ? await tryTable(() => supabase.from("subscriptions")) : null;
  if (pub) return pub;
  if (fromCore("subscriptions")) {
    return await tryTable(() => fromCore("subscriptions"));
  }
  return null;
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

async function fetchSubscriptionsRows(order) {
  const colsFull =
    "id, tenant_id, piano, stato, rinnovo_il, created_at, updated_at, ciclo_fatturazione_giorni, sconto_annuale_percent";
  const colsBasic = "id, tenant_id, piano, stato, rinnovo_il, created_at, updated_at";

  const withDefaults = (data) =>
    (data ?? []).map((r) => ({
      ...r,
      ciclo_fatturazione_giorni: r.ciclo_fatturazione_giorni ?? 30,
      sconto_annuale_percent: r.sconto_annuale_percent ?? null,
    }));

  if (PUBLIC_SUBSCRIPTIONS_AVAILABLE) {
    let pub = await supabase.from("subscriptions").select(colsFull).order("created_at", order);
    if (!pub.error) return withDefaults(pub.data);
    if (isTableNotInSchemaCacheError(pub.error)) {
      PUBLIC_SUBSCRIPTIONS_AVAILABLE = false;
      writeStorage(SUBSCRIPTIONS_PUBLIC_KEY, "false");
    } else if (isMissingColumnOrSchemaCacheError(pub.error)) {
      pub = await supabase.from("subscriptions").select(colsBasic).order("created_at", order);
      if (!pub.error) return withDefaults(pub.data);
    }
  }

  const subCore = fromCore("subscriptions");
  if (!subCore) return [];
  let coreQ = await subCore.select(colsFull).order("created_at", order);
  if (!coreQ.error) return withDefaults(coreQ.data);
  if (isMissingColumnOrSchemaCacheError(coreQ.error)) {
    coreQ = await subCore.select(colsBasic).order("created_at", order);
    if (!coreQ.error) return withDefaults(coreQ.data);
  }
  if (coreQ.error && !isSchemaNotExposedError(coreQ.error)) return [];
  return [];
}

/**
 * Elenco subscription con nome tenant (solo superadmin).
 * Prova `public.subscriptions`, poi `core.subscriptions` (schema enterprise nelle migrazioni).
 * In Supabase Dashboard → Settings → API, lo schema `core` deve essere tra gli "Exposed schemas"
 * affinché PostgREST serva le tabelle core.
 */
export async function getSubscriptions() {
  const order = { ascending: false };
  let rows = await fetchSubscriptionsRows(order);

  const tenants = await getTenants();
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const subTenantIds = new Set(rows.map((s) => s.tenant_id));

  /** Crea righe subscription mancanti (tenant senza record) così la pagina Abbonamenti è allineata ai clienti. */
  const missing = tenants.filter((t) => t.id && !subTenantIds.has(t.id));
  for (const t of missing) {
    await upsertSubscriptionForTenant(t, t).catch(() => {});
  }
  if (missing.length > 0) {
    rows = await fetchSubscriptionsRows(order);
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

  // Se alcune righe non sono scrivibili in subscriptions (RLS/migrazione), mostra comunque il cliente in elenco
  // usando i dati tenant, così la pagina Licenze non risulta "incompleta" per quei tenant.
  const enrichedTenantIds = new Set(enriched.map((r) => r.tenant_id));
  const derivedMissingRows = tenants
    .filter((t) => t.id && !enrichedTenantIds.has(t.id))
    .map((t) => {
      const ciclo = parseAbbonamentoCicloGiorni(t, t);
      const sconto = parseScontoAnnualePercent(t, t, ciclo);
      return {
        id: `tenant-${t.id}`,
        tenant_id: t.id,
        piano: pianoToDbEnum(t.piano),
        stato: "ATTIVA",
        rinnovo_il: computeProssimoRinnovoIl(t.data_attivazione_abbonamento, ciclo),
        ciclo_fatturazione_giorni: ciclo,
        sconto_annuale_percent: sconto,
        created_at: t.created_at ?? null,
        updated_at: t.updated_at ?? null,
        tenant_nome: t.nome ?? "—",
        tenant_slug: t.slug ?? "—",
        rinnovo_automatico: !!t.addebito_automatico_mensile,
        data_attivazione_abbonamento: t.data_attivazione_abbonamento ?? null,
        _fromTenantOnly: true,
      };
    });

  if (derivedMissingRows.length > 0) {
    return [...enriched, ...derivedMissingRows].sort((a, b) => {
      const ad = String(a.created_at || "");
      const bd = String(b.created_at || "");
      return ad < bd ? 1 : ad > bd ? -1 : 0;
    });
  }

  /** Se non esiste alcuna riga in subscriptions (es. policy RLS che blocca insert), mostra comunque i clienti come righe derivate dal tenant. */
  if (enriched.length === 0 && tenants.length > 0) {
    return tenants.map((t) => ({
      id: `tenant-${t.id}`,
      tenant_id: t.id,
      piano: pianoToDbEnum(t.piano),
      stato: "ATTIVA",
      rinnovo_il: computeProssimoRinnovoIl(t.data_attivazione_abbonamento, 30),
      ciclo_fatturazione_giorni: 30,
      sconto_annuale_percent: null,
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

const REGISTRATORE_TABLE = "superadmin_registratore_state";
const REGISTRATORE_AUDIT_TABLE = "superadmin_registratore_audit";

function isRegistratoreUnavailableError(err) {
  if (!err) return false;
  const m = String(err.message ?? err ?? "");
  const c = err.code;
  return (
    isTableNotInSchemaCacheError(err) ||
    c === "PGRST205" ||
    c === "42P01" ||
    /relation .* does not exist/i.test(m)
  );
}

/**
 * Carica lo stato JSON del registratore cassa standalone (solo riga dell'utente corrente).
 * RLS: superadmin solo propria riga.
 */
export async function fetchRegistratoreState(userId) {
  if (!userId) {
    return { row: null, error: null, unavailable: true };
  }
  const { data, error } = await supabase
    .from(REGISTRATORE_TABLE)
    .select("payload, updated_at, revision")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isRegistratoreUnavailableError(error)) {
      return { row: null, error, unavailable: true };
    }
    logSupabaseError("superadmin.fetchRegistratoreState", error, { userId });
    return { row: null, error, unavailable: false };
  }
  return { row: data, error: null, unavailable: false };
}

/**
 * Salva (upsert) il blob JSON sul server.
 * `revision` e `updated_at` sono impostati dai trigger DB (multi-scheda: ultimo salvataggio vince).
 * @returns {{ revision: number, updated_at: string } | null}
 */
export async function upsertRegistratoreState(userId, payload) {
  if (!userId) {
    throw new Error("userId obbligatorio");
  }
  const { data, error } = await supabase
    .from(REGISTRATORE_TABLE)
    .upsert({ user_id: userId, payload }, { onConflict: "user_id" })
    .select("revision, updated_at")
    .single();

  if (error) {
    if (isRegistratoreUnavailableError(error)) {
      const e = new Error("Tabella non disponibile");
      e.code = "UNAVAILABLE";
      throw e;
    }
    logSupabaseError("superadmin.upsertRegistratoreState", error, { userId });
    throw error;
  }
  return data
    ? {
        revision: Number(data.revision) || 1,
        updated_at: data.updated_at,
      }
    : null;
}

/**
 * Ultime voci audit append-only (solo superadmin, proprio user_id).
 */
///////////////////////////////////////////////////////////
// ================ AGENTE AI (configurazione) ================
///////////////////////////////////////////////////////////
// Riga singola (agente_configurazione_singleton), RLS: solo superadmin. Vedi
// sql/modules/83_agente_ai_configurazione_conversazioni.sql.

export async function getAgenteConfigurazione() {
  const { data, error } = await supabase.from("agente_configurazione").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateAgenteConfigurazione(updates) {
  const { data: existing } = await supabase.from("agente_configurazione").select("id").maybeSingle();
  if (!existing?.id) throw new Error("Configurazione agente non trovata.");
  const { error } = await supabase
    .from("agente_configurazione")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) throw error;
}

/**
 * Configurazione dell'alert email al supporto per errori nei tenant operativi (vedi
 * sql/modules/102_alert_errori_supporto.sql). Passa da RPC SECURITY DEFINER (non da
 * .from("piattaforma_alert_configurazione")) perché la RLS della tabella richiede comunque il
 * controllo ruolo, già incapsulato nella RPC — coerente con getAgenteConfigurazione sopra ma con
 * un controllo esplicito lato server invece che affidarsi solo a RLS.
 */
export async function getAlertErroriConfigurazione() {
  const { data, error } = await supabase.rpc("pm_get_alert_configurazione");
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function updateAlertErroriConfigurazione({ emailSupporto, attivo }) {
  const { error } = await supabase.rpc("pm_set_alert_configurazione", {
    p_email: emailSupporto ?? null,
    p_attivo: Boolean(attivo),
  });
  if (error) throw error;
}

/**
 * Configurazione generale piattaforma (nome applicazione, contatti supporto mostrati ai clienti).
 * Lettura pubblica via RLS (grant a anon+authenticated), scrittura solo superadmin.
 */
export async function getConfigurazioneGenerale() {
  const { data, error } = await supabase
    .from("piattaforma_configurazione_generale")
    .select("nome_applicazione, email_supporto, url_supporto, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateConfigurazioneGenerale({ nomeApplicazione, emailSupporto, urlSupporto }) {
  const { data: existing } = await supabase
    .from("piattaforma_configurazione_generale")
    .select("id")
    .maybeSingle();
  if (!existing?.id) throw new Error("Configurazione generale non trovata.");
  const { error } = await supabase
    .from("piattaforma_configurazione_generale")
    .update({
      nome_applicazione: (nomeApplicazione || "").trim() || "PizzaManager",
      email_supporto: (emailSupporto || "").trim() || null,
      url_supporto: (urlSupporto || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (error) throw error;
}

/**
 * Reimposta la password REALE (Supabase Auth) di un account staff/cliente di un tenant — solo
 * superadmin (verificato anche server-side nella edge function). Usata da "Archivio password
 * staff" per evitare di dover aprire il pannello Supabase a parte.
 */
export async function resetAccountPasswordReale({ tenantId, userId, password }) {
  const { data, error } = await supabase.functions.invoke("reset-account-password", {
    body: { tenant_id: tenantId, user_id: userId, password },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

const REGISTRO_SELECT =
  "id, richiesta, azioni, area, fonte, stato, branch, pr_url, creato_il";
const REGISTRO_SELECT_LEGACY = "id, richiesta, azioni, area, creato_il";

/**
 * Registro richieste/azioni di sviluppo — visibile e scrivibile solo superadmin (RLS).
 */
export async function getRegistroRichiesteSviluppo({ limit = 500 } = {}) {
  const q = supabase
    .from("log_richieste_sviluppo")
    .select(REGISTRO_SELECT)
    .order("creato_il", { ascending: false })
    .limit(limit);
  const { data, error } = await q;
  if (error && /fonte|stato|branch|pr_url/i.test(error.message || "")) {
    const fallback = await supabase
      .from("log_richieste_sviluppo")
      .select(REGISTRO_SELECT_LEGACY)
      .order("creato_il", { ascending: false })
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return fallback.data || [];
  }
  if (error) throw error;
  return data || [];
}

export async function insertRegistroRichiestaSviluppo({
  richiesta,
  azioni,
  area = null,
  fonte = "umano",
  stato = "completato",
  branch = null,
  pr_url = null,
}) {
  const row = {
    richiesta: String(richiesta || "").trim(),
    azioni: String(azioni || "").trim(),
    area: area ? String(area).trim() : null,
    fonte: fonte ? String(fonte).trim() : "umano",
    stato: stato ? String(stato).trim() : "completato",
    branch: branch ? String(branch).trim() : null,
    pr_url: pr_url ? String(pr_url).trim() : null,
  };
  if (!row.richiesta || !row.azioni) {
    throw new Error("Servono sia la richiesta sia cosa è stato fatto.");
  }
  const { data, error } = await supabase
    .from("log_richieste_sviluppo")
    .insert(row)
    .select(REGISTRO_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRegistroRichiestaSviluppo(id) {
  if (!id) throw new Error("Id mancante.");
  const { error } = await supabase.from("log_richieste_sviluppo").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRegistratoreAuditLog(userId, { limit = 20 } = {}) {
  if (!userId) {
    return { rows: [], error: null, unavailable: true };
  }
  const { data, error } = await supabase
    .from(REGISTRATORE_AUDIT_TABLE)
    .select("id, op, revision, created_at, payload_before, payload_after")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  if (error) {
    if (isRegistratoreUnavailableError(error)) {
      return { rows: [], error, unavailable: true };
    }
    logSupabaseError("superadmin.fetchRegistratoreAuditLog", error, { userId });
    return { rows: [], error, unavailable: false };
  }
  return { rows: data ?? [], error: null, unavailable: false };
}
