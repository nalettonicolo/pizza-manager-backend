/**
 * Piani commerciali Super Admin — stessa fonte per pagina Piani e landing pubblica.
 * Persistenza: localStorage (chiavi sotto).
 */

import {
  IDS_BASE,
  IDS_ENTERPRISE,
  IDS_FULL,
  IDS_PRO,
} from "@/features/superadmin/catalog/defaultCatalog";
import {
  formatEuroMonth,
  loadServicesCatalog,
  sumMonthlyFromInclusioni,
} from "@/features/superadmin/catalog/servicesStorage";

export const PLANS_STORAGE_KEY_V2 = "pizzamanager_superadmin_plans_v2";
export const PLANS_STORAGE_KEY_V1 = "pizzamanager_superadmin_plans_v1";

export function defaultInclusioni(services) {
  return Object.fromEntries((services || []).map((s) => [s.id, false]));
}

export function inclusioniFromIds(services, ids) {
  const set = new Set(ids);
  return Object.fromEntries((services || []).map((s) => [s.id, set.has(s.id)]));
}

/** Canone: somma dei prezzi base dei servizi inclusi (unica fonte). */
export function displayPrezzoForPlan(p, services) {
  return formatEuroMonth(sumMonthlyFromInclusioni(p.inclusioni, services));
}

/** Etichetta validità listino in mesi (calendario). */
export function formatValiditaMesiLabel(mesi) {
  const n = Math.max(1, Math.floor(Number(mesi) || 1));
  return n === 1 ? "1 mese" : `${n} mesi`;
}

export function buildDefaultPlans(services) {
  const z = defaultInclusioni(services);
  const sumForIds = (ids) => sumMonthlyFromInclusioni(inclusioniFromIds(services, ids), services);

  return [
    {
      id: "seed_base",
      nome: "Base",
      prezzo: formatEuroMonth(sumForIds(IDS_BASE)),
      descrizione: "Ordini a cassa, stampa comanda riepilogo ordine e gestione consegne.",
      attivo: true,
      validitaMesi: 1,
      scontoAbbonamentoAnnualePercent: 12,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_BASE) },
    },
    {
      id: "seed_pro",
      nome: "Pro",
      prezzo: formatEuroMonth(sumForIds(IDS_PRO)),
      descrizione: "Include tutto il Base più ordini online (cliente finale).",
      attivo: true,
      validitaMesi: 1,
      scontoAbbonamentoAnnualePercent: 12,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_PRO) },
    },
    {
      id: "seed_enterprise",
      nome: "Enterprise",
      prezzo: formatEuroMonth(sumForIds(IDS_ENTERPRISE)),
      descrizione:
        "Include tutto il Pro più interfacce tablet dedicate per ruoli operativi (cassa, bancone, cucina, delivery, pizzaiolo).",
      attivo: true,
      validitaMesi: 1,
      scontoAbbonamentoAnnualePercent: 12,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_ENTERPRISE) },
    },
    {
      id: "seed_full",
      nome: "Full",
      prezzo: formatEuroMonth(sumForIds(IDS_FULL)),
      descrizione: "Tutti i servizi del catalogo.",
      attivo: true,
      validitaMesi: 1,
      scontoAbbonamentoAnnualePercent: 12,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_FULL) },
    },
    {
      id: "seed_su_misura",
      nome: "Su misura",
      prezzo: formatEuroMonth(0),
      descrizione: "Il cliente sceglie i servizi dal catalogo; il canone è la somma dei servizi selezionati.",
      attivo: true,
      validitaMesi: 1,
      scontoAbbonamentoAnnualePercent: 12,
      inclusioni: { ...z },
    },
  ];
}

const LEGACY_LABEL_HINTS = [
  { id: "ordini_online", needle: "ordini online" },
  { id: "tablet_ruoli", needle: "tablet" },
  { id: "report_analisi", needle: "report" },
  { id: "multi_sede", needle: "multipli" },
  { id: "ruoli_avanzati", needle: "ruoli" },
  { id: "supporto_prioritario", needle: "supporto" },
  { id: "menu_listini", needle: "menu" },
  { id: "api_integrazioni", needle: "api" },
  { id: "account_manager", needle: "account" },
  { id: "sla_personalizzazioni", needle: "sla" },
];

function migrateLegacyPlan(p, services) {
  const inc = defaultInclusioni(services);
  const lines = (p.funzionalita || []).map((s) => String(s).toLowerCase());
  for (const { id, needle } of LEGACY_LABEL_HINTS) {
    if (lines.some((line) => line.includes(needle) || line.includes(id.replace(/_/g, " ")))) {
      if (services.some((s) => s.id === id)) inc[id] = true;
    }
  }
  if (lines.some((l) => l.includes("pro") && l.includes("tutto"))) {
    services.forEach((s) => {
      inc[s.id] = true;
    });
  }
  const merged = { ...inc, ...(p.inclusioni || {}) };
  const out = defaultInclusioni(services);
  for (const s of services) {
    out[s.id] = merged[s.id] === true;
  }
  const prezzoDaSomma = formatEuroMonth(sumMonthlyFromInclusioni(out, services));
  const scontoAnn =
    p.scontoAbbonamentoAnnualePercent != null && p.scontoAbbonamentoAnnualePercent !== ""
      ? Math.min(100, Math.max(0, Number(p.scontoAbbonamentoAnnualePercent) || 0))
      : 0;
  let validitaMesi;
  if (p.validitaMesi != null && p.validitaMesi !== "") {
    validitaMesi = Math.max(1, Math.floor(Number(p.validitaMesi)) || 1);
  } else if (p.validitaGiorni != null && p.validitaGiorni !== "") {
    const g = Number(p.validitaGiorni);
    if (Number.isFinite(g) && g >= 360) validitaMesi = 12;
    else if (Number.isFinite(g) && g >= 25 && g <= 35) validitaMesi = 1;
    else if (Number.isFinite(g) && g > 0) validitaMesi = Math.max(1, Math.round(g / 30));
    else validitaMesi = 1;
  } else {
    validitaMesi = 1;
  }
  return {
    id: p.id,
    nome: p.nome ?? "",
    prezzo: prezzoDaSomma,
    descrizione: p.descrizione ?? "",
    attivo: p.attivo === false ? false : true,
    validitaMesi,
    scontoAbbonamentoAnnualePercent: scontoAnn,
    inclusioni: out,
  };
}

export function normalizePlan(p, services) {
  const base = migrateLegacyPlan(p, services);
  if (typeof base.attivo !== "boolean") base.attivo = true;
  return base;
}

export function loadPlansFromStorage(services) {
  try {
    const raw = localStorage.getItem(PLANS_STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map((p) => normalizePlan(p, services));
    }
    const rawV1 = localStorage.getItem(PLANS_STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (Array.isArray(parsed) && parsed.length) {
        const migrated = parsed.map((p) => migrateLegacyPlan(p, services));
        try {
          localStorage.setItem(PLANS_STORAGE_KEY_V2, JSON.stringify(migrated));
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function savePlansToStorage(list) {
  try {
    localStorage.setItem(PLANS_STORAGE_KEY_V2, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function inclusioniIncluded(inc, services) {
  if (!inc || !services?.length) return [];
  return services.filter((s) => inc[s.id] === true);
}

/**
 * Catalogo servizi + elenco piani risolto (storage o seed), come in Super Admin → Piani.
 */
export function loadPlansResolved() {
  const services = loadServicesCatalog();
  const stored = loadPlansFromStorage(services);
  const plans = stored ?? buildDefaultPlans(services).map((p) => normalizePlan(p, services));
  return { services, plans };
}

/** Piani con `attivo !== false` per marketing (landing). */
export function getActivePlansForMarketing() {
  const { services, plans } = loadPlansResolved();
  return {
    services,
    plans: plans.filter((p) => p.attivo !== false),
  };
}
