import { useCallback, useMemo } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { IDS_BASE, IDS_ENTERPRISE, IDS_PRO } from "@/features/superadmin/catalog/defaultCatalog";
import { IDS_FULL } from "@/config/serviziAppRegistro";

const KNOWN_SERVIZIO_IDS = new Set(IDS_FULL);

/** Disattiva ogni gate (anche se ENFORCE è true) — emergenza / debug. */
export function isServiziGateBypassed() {
  return import.meta.env.VITE_DISABLE_SERVIZI_GATE === "true";
}

/**
 * Gate sui servizi: sempre disattivato — nessun blocco in base al piano o al catalogo moduli.
 * (Il bypass VITE_DISABLE_SERVIZI_GATE resta per compatibilità con eventuali script.)
 */
export function isServiziPlanEnforcementEnabled() {
  return false;
}

/**
 * Insieme di id servizio inclusi nel piano tenant, allineato ai bundle in Super Admin → Piani.
 * TRIAL è trattato come PRO per funzionalità operative; FREE solo Base.
 */
export function serviziIdsIncludedForPiano(piano) {
  const p = String(piano ?? "TRIAL").toUpperCase();
  if (p === "ENTERPRISE") return new Set(IDS_ENTERPRISE);
  if (p === "PRO" || p === "TRIAL") return new Set(IDS_PRO);
  if (p === "FREE") return new Set(IDS_BASE);
  return new Set(IDS_PRO);
}

/**
 * Bundle effettivo:
 * - Con `parametri_operativi.servizi_personalizzati === true` e lista non vuota: solo quegli id (catalogo noto).
 * - Altrimenti bundle da enum `piano`, con eventuale intersezione con `servizi_abilitati` per disattivare voci incluse nel piano.
 */
export function resolveServiziIdsForTenant(tenantData) {
  const pianoSet = serviziIdsIncludedForPiano(tenantData?.piano);
  const po = tenantData?.parametri_operativi;
  const raw = po?.servizi_abilitati;
  const personalized = po?.servizi_personalizzati === true;

  if (personalized && Array.isArray(raw) && raw.length > 0) {
    const wanted = new Set();
    for (const x of raw) {
      const id = typeof x === "string" ? x.trim() : "";
      if (id && KNOWN_SERVIZIO_IDS.has(id)) wanted.add(id);
    }
    if (wanted.size > 0) return wanted;
  }

  if (!Array.isArray(raw) || raw.length === 0) return pianoSet;

  const wanted = new Set();
  for (const x of raw) {
    const id = typeof x === "string" ? x.trim() : "";
    if (id && KNOWN_SERVIZIO_IDS.has(id) && pianoSet.has(id)) wanted.add(id);
  }
  if (wanted.size === 0) {
    console.warn(
      "[useTenantServizi] servizi_abilitati vuoto o non valido rispetto al piano; si usa il bundle piano.",
    );
    return pianoSet;
  }
  return wanted;
}

export function useTenantServizi() {
  const { tenantData } = useTenant();
  const piano = tenantData?.piano;
  const enforcementActive = isServiziPlanEnforcementEnabled();

  const serviziIds = useMemo(() => resolveServiziIdsForTenant(tenantData), [tenantData]);

  /** Bundle tenant senza guard enforcement (per UI contabilità semplice vs completa). */
  const contabilitaMode = useMemo(() => {
    const full = serviziIds.has("contabilita_locale");
    const semplice = serviziIds.has("contabilita_semplice");
    if (full) return "full";
    if (semplice) return "semplice";
    return "none";
  }, [serviziIds]);

  const hasServizio = useCallback(
    (id) => {
      if (!enforcementActive) return true;
      if (!id) return true;
      if (serviziIds.has(id)) return true;
      /* Presa ordini in cassa e stampa comanda sono un unico flusso: non richiedere due flag separati. */
      if (id === "stampa_comanda" && serviziIds.has("ordini_cassa")) return true;
      return false;
    },
    [enforcementActive, serviziIds],
  );

  return { hasServizio, serviziIds, enforcementActive, piano, contabilitaMode };
}
