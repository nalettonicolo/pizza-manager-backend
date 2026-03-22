/** Etichette piano SaaS in UI (codici DB: TRIAL, PRO, ENTERPRISE, FREE, …) */
export const PIANO_LABEL = {
  TRIAL: "Prova (7 gg)",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
  FREE: "Gratuito (legacy)",
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
