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
