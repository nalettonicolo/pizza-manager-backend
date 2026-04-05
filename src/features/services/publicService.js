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

/**
 * Menu vetrina pubblica.
 * @param {{ tenantId?: string | null }} [options] — Su SaaS (es. /preview, /negozio): se passato, filtra per tenant (stesso usato da getPublicTenantInfo).
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
    return sortByOrdine(rows);
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

  return sortByOrdine(data || []);
}

// Info tenant per home pubblica (usata per messaggi tipo "oggi siamo chiusi").
// Su domini dedicati: risoluzione tramite RPC in base a admin.tenants.public_domain.
export async function getPublicTenantInfo() {
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

  const { data, error } = await supabase
    .from("tenants")
    .select("id, nome, logo_url, indirizzo, email, telefono, orari_settimana, parametri_operativi")
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError("publicService.getPublicTenantInfo", error, {
      operation: "from(tenants).select(...).limit(1).maybeSingle",
    });
    return null;
  }

  return data || null;
}
