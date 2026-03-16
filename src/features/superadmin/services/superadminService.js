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

/**
 * Elenco di tutti i tenant (solo superadmin).
 */
export async function getTenants() {
  const q = supabase
    .from("tenants")
    .select("id, nome, slug, piano, attivo, created_at, updated_at, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    const coreQ = fromCore("tenants")
      .select("id, nome, slug, piano, attivo, created_at, updated_at, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    const res = await coreQ;
    if (res.error) throw res.error;
    return res.data ?? [];
  }
  return data ?? [];
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
export async function createTenant(payload) {
  const row = {
    nome: payload.nome,
    slug: payload.slug,
    piano: payload.piano ?? "FREE",
    attivo: payload.attivo ?? true,
  };
  const { data, error } = await supabase.from("tenants").insert(row).select().single();
  if (!error) return data;
  const res = await fromCore("tenants").insert(row).select().single();
  if (res.error) throw res.error;
  return res.data;
}

/**
 * Aggiorna un tenant.
 */
export async function updateTenant(id, updates) {
  const { error } = await supabase.from("tenants").update(updates).eq("id", id);
  if (!error) return;
  const res = await fromCore("tenants").update(updates).eq("id", id);
  if (res.error) throw res.error;
}

/**
 * Elenco subscription con nome tenant (solo superadmin).
 * Usa solo schema public per evitare errore "schema must be public, graphql_public".
 */
export async function getSubscriptions() {
  const cols = "id, tenant_id, piano, stato, rinnovo_il, created_at, updated_at";
  const { data: list, error } = await supabase
    .from("subscriptions")
    .select(cols)
    .order("created_at", { ascending: false });
  if (error) return [];
  const rows = list ?? [];

  if (rows.length === 0) return rows;

  const tenants = await getTenants();
  const tenantMap = tenants.reduce((acc, t) => ({ ...acc, [t.id]: { nome: t.nome, slug: t.slug } }), {});

  return rows.map((s) => ({
    ...s,
    tenant_nome: tenantMap[s.tenant_id]?.nome ?? "—",
    tenant_slug: tenantMap[s.tenant_id]?.slug ?? "—",
  }));
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
    const p = t.piano ?? "FREE";
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
