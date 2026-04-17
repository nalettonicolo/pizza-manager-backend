import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/utils/logSupabaseError";
import { sortByOrdine } from "@/utils/sortByOrdine";
import { isSaaSHostname } from "@/utils/saasHost";

function getBrowserHostname() {
  if (typeof window === "undefined") return "";
  return String(window.location.hostname || "").toLowerCase();
}

function isRpcMissingError(err) {
  const m = String(err?.message ?? err ?? "");
  return /does not exist|Could not find the function/i.test(m);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Opzioni tenant da query string: `?tenant=<uuid>`, `?tenantId=<uuid>`, `?slug=<slug>`
 * @param {string} [searchString] — es. `location.search` (`?foo=bar`)
 */
export function parsePublicTenantQuery(searchString) {
  if (!searchString || typeof searchString !== "string") return {};
  const qs = searchString.startsWith("?") ? searchString : `?${searchString}`;
  let p;
  try {
    p = new URLSearchParams(qs);
  } catch {
    return {};
  }
  const id = (p.get("tenant") || p.get("tenantId") || "").trim();
  if (UUID_RE.test(id)) return { tenantId: id };
  const slug = (p.get("slug") || "").trim();
  if (slug) return { tenantSlug: slug };
  return {};
}

/**
 * Unisce esplicito + query URL.
 * @param {{ tenantId?: string | null, tenantSlug?: string | null, search?: string }} [options]
 */
export function mergePublicTenantOptions(options = {}) {
  const fromUrl = typeof options.search === "string" ? parsePublicTenantQuery(options.search) : {};
  return {
    tenantId: options.tenantId ?? fromUrl.tenantId ?? null,
    tenantSlug: options.tenantSlug ?? fromUrl.tenantSlug ?? null,
  };
}

/**
 * Su app SaaS (localhost, app.*): risolve il tenant per anteprima /negozio /preview.
 * Priorità: UUID in query → VITE_PUBLIC_DEMO_TENANT_ID → slug (tenantSlug o VITE_PUBLIC_DEMO_TENANT_SLUG o "demo")
 * → primo tenant che ha righe in prodotti_menu_pubblico → primo tenant per created_at.
 */
async function resolveSaaSPublicTenant(resolved = {}) {
  const { tenantId, tenantSlug } = resolved;

  if (tenantId) {
    const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
    if (!error && data) return data;
  }

  const envId = import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID;
  if (envId && String(envId).trim()) {
    const { data, error } = await supabase.from("tenants").select("*").eq("id", String(envId).trim()).maybeSingle();
    if (!error && data) return data;
  }

  const slugDefault = (import.meta.env.VITE_PUBLIC_DEMO_TENANT_SLUG ?? "demo").trim();
  const slugTry = (tenantSlug || slugDefault).trim();
  if (slugTry) {
    const { data, error } = await supabase.from("tenants").select("*").eq("slug", slugTry).maybeSingle();
    if (!error && data) return data;
  }

  return null;
}

async function getPublicMenuFromView(tenantId) {
  let q = supabase.from("prodotti_menu_pubblico").select("*");
  if (tenantId) {
    q = q.eq("tenant_id", tenantId);
  }
  const { data, error } = await q.order("nome", { ascending: true });

  if (error) {
    logSupabaseError("publicService.getPublicMenu", error, {
      operation: "from(prodotti_menu_pubblico)",
      tenantId: tenantId || undefined,
    });
    return [];
  }

  return sortByOrdine(
    (data || []).map(({ tenant_id: _tenantId, ...rest }) => rest),
  );
}

/**
 * Menu vetrina pubblica.
 * @param {{ tenantId?: string | null }} [options] — Su SaaS: filtra per tenant risolto (obbligatorio per non mescolare sedi).
 */
export async function getPublicMenu(options = {}) {
  const tenantId = options.tenantId ?? null;
  const host = getBrowserHostname();
  if (host && !isSaaSHostname(host)) {
    const { data, error } = await supabase.rpc("get_public_menu_for_domain", { p_host: host });
    if (error) {
      if (!isRpcMissingError(error)) {
        logSupabaseError("publicService.getPublicMenu.rpc", error, { p_host: host });
      }
      return [];
    }
    const rows = Array.isArray(data) ? data : [];
    return sortByOrdine(
      rows.map(({ tenant_id: _tenantId, ...rest }) => rest),
    );
  }

  if (isSaaSHostname(host) && !tenantId) {
    return [];
  }

  // Con REVOKE SELECT anon su prodotti_menu_pubblico, la lettura diretta fallisce: usa RPC SECURITY DEFINER.
  if (tenantId) {
    const { data, error } = await supabase.rpc("get_public_menu_for_tenant", {
      p_tenant_id: tenantId,
    });
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return sortByOrdine(
        rows.map(({ tenant_id: _tenantId, ...rest }) => rest),
      );
    }
    if (isRpcMissingError(error)) {
      return getPublicMenuFromView(tenantId);
    }
    logSupabaseError("publicService.getPublicMenu.rpc", error, {
      operation: "get_public_menu_for_tenant",
      p_tenant_id: tenantId,
    });
    return [];
  }

  return getPublicMenuFromView(null);
}

/**
 * Deduce categorie dai soli prodotti del menu (fallback se la RPC catalogo non è deployata).
 * @param {Array<Record<string, unknown>>} menu
 */
export function buildCategoriesFromMenuRows(menu) {
  const byId = new Map();
  for (const p of menu || []) {
    const cid = p.categoria_id;
    if (!cid) continue;
    const ord = Number(p.ordine) || 0;
    const cur = byId.get(cid);
    if (!cur) {
      byId.set(cid, { id: cid, nome: p.categoria_nome || "Altro", ordine: ord });
    } else {
      cur.ordine = Math.min(cur.ordine, ord);
      if (p.categoria_nome) cur.nome = p.categoria_nome;
    }
  }
  return sortByOrdine([...byId.values()]);
}

/**
 * Unisce categorie del menu con il catalogo `core.categorie` (stessi nomi/ordine dell'admin).
 * @param {Array<Record<string, unknown>>} menu
 * @param {Array<{ id: string, nome?: string, ordine?: number, slug?: string }>} catalogRows
 */
export function mergePublicCategoriesWithCatalog(menu, catalogRows) {
  const base = buildCategoriesFromMenuRows(menu);
  const catMap = new Map((catalogRows || []).map((c) => [c.id, c]));
  return sortByOrdine(
    base.map((c) => {
      const cat = catMap.get(c.id);
      if (!cat) return c;
      return {
        id: c.id,
        nome: (cat.nome && String(cat.nome).trim()) || c.nome,
        ordine: Number(cat.ordine) || c.ordine,
      };
    }),
  );
}

/**
 * Categorie catalogo per tenant (RPC SECURITY DEFINER). Usare insieme a mergePublicCategoriesWithCatalog.
 * @returns {Promise<Array<{ id: string, nome: string, ordine: number, slug: string | null }>>}
 */
export async function getPublicCategoriesForTenant(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase.rpc("get_public_categories_for_tenant", {
    p_tenant_id: tenantId,
  });
  if (error) {
    if (isRpcMissingError(error)) return [];
    logSupabaseError("publicService.getPublicCategoriesForTenant", error, {
      p_tenant_id: tenantId,
    });
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Nomi ingredienti per ricerca sul menu vetrina (sessione anon).
 * RPC `get_public_menu_ingredient_names`: tenant-safe, stessi filtri della vista pubblica prodotti.
 * @returns {Promise<Record<string, string[]> | null>} `null` se la RPC non è ancora deployata (fallback lato caller).
 */
export async function getPublicMenuIngredientNames(tenantId, productIds) {
  if (!tenantId || !productIds?.length) return {};
  const { data, error } = await supabase.rpc("get_public_menu_ingredient_names", {
    p_tenant_id: tenantId,
    p_product_ids: productIds,
  });
  if (error) {
    if (isRpcMissingError(error)) return null;
    logSupabaseError("publicService.getPublicMenuIngredientNames", error, {
      tenantId,
      count: productIds.length,
    });
    return {};
  }
  const map = {};
  for (const row of data || []) {
    const pid = row?.prodotto_id;
    if (pid) map[pid] = Array.isArray(row.nomi) ? row.nomi : [];
  }
  return map;
}

/**
 * Info tenant per home pubblica (chiuso oggi, branding, carrello).
 * @param {{ tenantId?: string | null, tenantSlug?: string | null, search?: string }} [options]
 * — `search`: tipicamente `location.search` per `?tenant=` / `?slug=`
 */
export async function getPublicTenantInfo(options = {}) {
  const host = getBrowserHostname();
  if (host && !isSaaSHostname(host)) {
    const { data, error } = await supabase.rpc("resolve_public_tenant_by_domain", { p_host: host });
    if (error) {
      if (!isRpcMissingError(error)) {
        logSupabaseError("publicService.getPublicTenantInfo.rpc", error, { p_host: host });
      }
      return null;
    }
    return data && typeof data === "object" ? data : null;
  }

  const search =
    options.search !== undefined && options.search !== null
      ? options.search
      : typeof window !== "undefined"
        ? window.location.search
        : "";
  const merged = mergePublicTenantOptions({ ...options, search });
  return resolveSaaSPublicTenant(merged);
}
