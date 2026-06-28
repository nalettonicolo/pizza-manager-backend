/**
 * Sincronizzazione catalogo Super Admin (servizi + piani) su admin.sa_catalog_snapshot.
 * Fallback: localStorage (plansStorage / servicesStorage).
 */

import { supabase } from "@/lib/supabaseClient"

const SNAPSHOT_KEY = "default"

function adminFrom() {
  try {
    return supabase.schema("admin").from("sa_catalog_snapshot")
  } catch {
    return null
  }
}

/** @returns {Promise<{ services: object[]|null, plans: object[]|null }|null>} */
export async function fetchSaCatalogFromDb() {
  const q = adminFrom()
  if (!q) return null
  const { data, error } = await q
    .select("services_json, plans_json, updated_at")
    .eq("snapshot_key", SNAPSHOT_KEY)
    .maybeSingle()
  if (error) {
    if (/schema must be one of/i.test(String(error.message ?? ""))) return null
    console.warn("[catalogRemoteSync] fetch:", error.message ?? error)
    return null
  }
  if (!data) return null
  return {
    services: Array.isArray(data.services_json) ? data.services_json : null,
    plans: Array.isArray(data.plans_json) ? data.plans_json : null,
    updatedAt: data.updated_at ?? null,
  }
}

/** @param {{ services?: object[], plans?: object[] }} payload */
export async function persistSaCatalogToDb(payload) {
  const q = adminFrom()
  if (!q) return { error: null, skipped: true }
  const row = {
    snapshot_key: SNAPSHOT_KEY,
    updated_at: new Date().toISOString(),
  }
  if (Array.isArray(payload.services)) row.services_json = payload.services
  if (Array.isArray(payload.plans)) row.plans_json = payload.plans
  const { error } = await q.upsert(row, { onConflict: "snapshot_key" })
  if (error && !/schema must be one of/i.test(String(error.message ?? ""))) {
    console.warn("[catalogRemoteSync] persist:", error.message ?? error)
  }
  return { error: error ?? null, skipped: false }
}
