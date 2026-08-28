/**
 * Sincronizzazione catalogo Super Admin (servizi + piani) su admin.sa_catalog_snapshot.
 * Fallback: localStorage (plansStorage / servicesStorage).
 *
 * Passa da due RPC (pm_get_catalog_snapshot / pm_set_catalog_snapshot) invece di
 * supabase.schema("admin").from("sa_catalog_snapshot") diretto: lo schema "admin" non è esposto
 * via PostgREST, quindi quella chiamata falliva sempre (silenziosamente, solo console.warn) — il
 * sync tra browser diversi del superadmin non ha mai funzionato. Le RPC girano in schema public
 * e verificano il ruolo superadmin internamente (SECURITY DEFINER), stesso pattern già in uso
 * altrove nel progetto per questo identico problema.
 */

import { supabase } from "@/lib/supabaseClient"

/** @returns {Promise<{ services: object[]|null, plans: object[]|null, updatedAt?: string|null }|null>} */
export async function fetchSaCatalogFromDb() {
  const { data, error } = await supabase.rpc("pm_get_catalog_snapshot")
  if (error) {
    console.warn("[catalogRemoteSync] fetch:", error.message ?? error)
    return null
  }
  if (!data) return null
  return {
    services: Array.isArray(data.services) ? data.services : null,
    plans: Array.isArray(data.plans) ? data.plans : null,
    updatedAt: data.updated_at ?? null,
  }
}

/** @param {{ services?: object[], plans?: object[] }} payload */
export async function persistSaCatalogToDb(payload) {
  const args = {}
  if (Array.isArray(payload.services)) args.p_services = payload.services
  if (Array.isArray(payload.plans)) args.p_plans = payload.plans
  const { error } = await supabase.rpc("pm_set_catalog_snapshot", args)
  if (error) {
    console.warn("[catalogRemoteSync] persist:", error.message ?? error)
  }
  return { error: error ?? null, skipped: false }
}
