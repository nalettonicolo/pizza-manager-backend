/** Account dedicato alla vista test 4 reparti (iframe). */
export const QUAD_REPARTI_TEST_EMAIL = "pizzaioli@pizzamanager.it"

export function isQuadRepartiTestEmail(email) {
  return typeof email === "string" && email.toLowerCase().trim() === QUAD_REPARTI_TEST_EMAIL
}
