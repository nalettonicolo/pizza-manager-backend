/** Etichette piano SaaS in UI (codici DB: TRIAL, PRO, ENTERPRISE, FREE, …) */
export const PIANO_LABEL = {
  BASE: "Base",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

/**
 * @param {string | null | undefined} piano
 * @returns {string}
 */
export function pianoDisplayLabel(piano) {
  if (piano == null || piano === "") return "—";
  const k = String(piano).trim().toUpperCase();
  return PIANO_LABEL[k] ?? piano;
}

/**
 * Seconda riga opzionale per tabella clienti (listino / su misura).
 * @param {{ parametri_operativi?: Record<string, unknown> } | null | undefined} tenant
 * @returns {string | null}
 */
export function tenantListinoLabel(tenant) {
  const po = tenant?.parametri_operativi;
  if (!po || typeof po !== "object") return null;
  const nome = typeof po.piano_listino_nome === "string" ? po.piano_listino_nome.trim() : "";
  if (po.servizi_personalizzati === true) {
    if (nome) return `${nome} · personalizzato`;
    return "Servizi su misura";
  }
  return nome || null;
}
