import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest"

/** Dopo login account test pizzaiolo: scelta tra schermata full e griglia 4 reparti. */
export const PIZZAIOLO_TEST_INGRESSO_PATH = "/operative/pizzaiolo-ingresso"

/** Home operativa dopo login (allineato al menù sidebar). */
export const OPERATIVE_ROLE_HOME = {
  operatore: "/operative/dashboard",
  pizzaiolo: "/operative/pizzaioli",
  cassa: "/operative/cassa",
  bancone: "/operative/bancone",
  cucina: "/operative/cucina",
  delivery: "/operative/delivery",
  pony: "/operative/delivery",
}

/**
 * Destinazione staff operativo (login / scelta PV). Account test → pagina 2 pulsanti (Pizzaiolo / Test).
 * @param {string | null | undefined} ruolo
 * @param {string | null | undefined} email
 */
export function getOperativeHomePathForStaff(ruolo, email) {
  const r = (ruolo && String(ruolo).toLowerCase().trim()) || ""
  if (r === "pizzaiolo" && isQuadRepartiTestEmail(email)) {
    return PIZZAIOLO_TEST_INGRESSO_PATH
  }
  return OPERATIVE_ROLE_HOME[r] || "/operative/dashboard"
}
