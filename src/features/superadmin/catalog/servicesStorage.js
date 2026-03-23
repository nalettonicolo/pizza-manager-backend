import {
  DEFAULT_SERVICES_CATALOG,
  STORAGE_KEY_SERVICES_V1,
  STORAGE_KEY_SERVICES_V2,
} from "./defaultCatalog";

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {unknown} s */
function normalizeService(s) {
  if (!s || typeof s !== "object") return null;
  const id = typeof s.id === "string" ? s.id.trim() : "";
  const nome = typeof s.nome === "string" ? s.nome.trim() : "";
  if (!id || !nome) return null;
  const prezzoMensile = Number(s.prezzoMensile);
  const funzioni = Array.isArray(s.funzioni)
    ? s.funzioni.map((x) => String(x).trim()).filter(Boolean)
    : typeof s.funzioni === "string"
      ? s.funzioni
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  const categoria =
    typeof s.categoria === "string" && s.categoria.trim() ? s.categoria.trim() : "Altro";
  const attivo = s.attivo !== false;
  return {
    id,
    nome,
    categoria,
    funzioni,
    attivo,
    prezzoMensile: Number.isFinite(prezzoMensile) ? Math.max(0, prezzoMensile) : 0,
  };
}

/**
 * Unisce il catalogo predefinito con quanto salvato (nome, prezzo, funzioni personalizzati).
 * Mantiene anche servizi aggiunti dall’utente che non sono nel default.
 */
export function mergeCatalogWithDefaults(storedList) {
  const defaultById = Object.fromEntries(DEFAULT_SERVICES_CATALOG.map((d) => [d.id, { ...d }]));
  const storedById = {};
  for (const raw of storedList || []) {
    const n = normalizeService(raw);
    if (n) storedById[n.id] = n;
  }

  const merged = DEFAULT_SERVICES_CATALOG.map((d) => {
    const o = storedById[d.id];
    if (!o) return { ...d };
    const hasExplicitPrice = o.prezzoMensile != null && o.prezzoMensile !== "";
    return {
      ...d,
      nome: o.nome,
      categoria: o.categoria || d.categoria,
      funzioni: o.funzioni?.length ? o.funzioni : d.funzioni,
      attivo: o.attivo !== false,
      prezzoMensile: hasExplicitPrice ? Math.max(0, Number(o.prezzoMensile) || 0) : d.prezzoMensile,
    };
  });

  const defaultIds = new Set(DEFAULT_SERVICES_CATALOG.map((x) => x.id));
  for (const id of Object.keys(storedById)) {
    if (!defaultIds.has(id)) {
      merged.push(storedById[id]);
    }
  }
  return merged;
}

export function loadServicesCatalog() {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_SERVICES_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed) && parsed.length) {
        return mergeCatalogWithDefaults(parsed.map(normalizeService).filter(Boolean));
      }
    }
    const rawV1 = localStorage.getItem(STORAGE_KEY_SERVICES_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (Array.isArray(parsed) && parsed.length) {
        const migrated = parsed
          .map((x) => {
            const n = normalizeService({
              ...x,
              funzioni: x.funzioni ?? [],
              categoria: x.categoria ?? "Altro",
              prezzoMensile: x.prezzoMensile ?? 0,
            });
            return n;
          })
          .filter(Boolean);
        const merged = mergeCatalogWithDefaults(migrated);
        try {
          localStorage.setItem(STORAGE_KEY_SERVICES_V2, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
        return merged;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SERVICES_CATALOG.map((s) => ({ ...s }));
}

export function saveServicesCatalog(list) {
  try {
    localStorage.setItem(STORAGE_KEY_SERVICES_V2, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function createEmptyService() {
  return {
    id: uid("svc"),
    nome: "",
    categoria: "Altro",
    funzioni: [],
    attivo: true,
    prezzoMensile: 0,
  };
}

export { uid };

/**
 * Somma prezzi mensili per i servizi inclusi.
 * @param {Record<string, boolean>} inclusioni
 * @param {Array<{ id: string, prezzoMensile: number }>} services
 */
export function sumMonthlyFromInclusioni(inclusioni, services) {
  if (!inclusioni || !services?.length) return 0;
  let t = 0;
  for (const s of services) {
    if (inclusioni[s.id] === true) {
      t += Number(s.prezzoMensile) || 0;
    }
  }
  return Math.round(t * 100) / 100;
}

export function formatEuroMonth(total) {
  const n = Number(total);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  const fmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${fmt.format(rounded)} €/mese`;
}
