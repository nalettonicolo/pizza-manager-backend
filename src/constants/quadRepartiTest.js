import { isSuperAdminRole } from "@/utils/superAdminAccess"

/** Account principale dedicato alla vista test 4 reparti. */
export const QUAD_REPARTI_TEST_EMAIL = "pizzaioli@pizzamanager.it"

const QUAD_REPARTI_TEST_EMAILS = new Set([
  "pizzaioli@pizzamanager.it",
  "pizzaiolo@pizzamanager.it",
])

/**
 * Account staff interno PizzaManager usati per collaudo 4 schermate
 * (`pizzaiolo@` / `pizzaioli@`, anche con numero: pizzaiolo2@…).
 */
export function isQuadRepartiTestEmail(email) {
  const e = typeof email === "string" ? email.toLowerCase().trim() : ""
  if (!e) return false
  if (QUAD_REPARTI_TEST_EMAILS.has(e)) return true
  return /^pizzaiol[oi]\d*@pizzamanager\.it$/.test(e)
}

/**
 * Chi può aprire `/operative/test-reparti-quad`: Super Admin, account test @pizzamanager.it,
 * o sessione Demo live. I tenant cliente restano fuori.
 */
export function canAccessQuadReparti({ email, ruolo, inDemo = false } = {}) {
  return isQuadRepartiTestEmail(email) || isSuperAdminRole(ruolo) || Boolean(inDemo)
}
