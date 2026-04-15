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
  return /could not find the table/i.test(m);
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
  "addebito_automatico_mensile, data_attivazione_abbonamento, sconto_percentuale, prova_valida_fino, " +
  "public_domain, public_domain_status, public_domain_requested_at, sito_web_cliente, parametri_operativi";

/** Come FULL ma senza sito_web_cliente (DB non ancora migrato). */
const TENANT_SELECT_NO_SITO_WEB =
  "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at, " +
  "partita_iva, email_fatturazione, pec, codice_univoco_sdi, " +
  "addebito_automatico_mensile, data_attivazione_abbonamento, sconto_percentuale, prova_valida_fino, " +
  "public_domain, public_domain_status, public_domain_requested_at, parametri_operativi";

const TENANT_SELECT_LEGACY = "id, nome, slug, piano, attivo, created_at, updated_at, deleted_at";

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
  const attempts = [TENANT_SELECT_FULL, TENANT_SELECT_NO_SITO_WEB, TENANT_SELECT_LEGACY];
  const quiet = !VERBOSE_TENANTS_LIST;
  let lastErr = null;
  for (const cols of attempts) {
    try {
      return await fetchTenantsList(cols, { quiet });
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
  const { error } = await supabase.from("tenants").update(row).eq("id", id);
  if (error) {
    logSupabaseError("superadmin.updateTenantPublicDomain", error, { id });
    throw error;
  }
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
  let r = await supabase.from("subscriptions").upsert(subRow, opts).select().single();
  if (!r.error) return;

  if (isTableNotInSchemaCacheError(r.error)) {
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

  const pub = await tryTable(() => supabase.from("subscriptions"));
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

  let pub = await supabase.from("subscriptions").select(colsFull).order("created_at", order);
  if (!pub.error) return withDefaults(pub.data);
  if (!isTableNotInSchemaCacheError(pub.error) && isMissingColumnOrSchemaCacheError(pub.error)) {
    pub = await supabase.from("subscriptions").select(colsBasic).order("created_at", order);
    if (!pub.error) return withDefaults(pub.data);
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
