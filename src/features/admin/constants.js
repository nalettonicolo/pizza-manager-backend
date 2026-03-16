/**
 * Etichette e convenzioni area Admin.
 *
 * INGREDIENTI
 * - In creazione ingredienti: prezzo è UNITARIO → usare label "Prezzo unitario" (non "al chilo").
 * - In sezione Calcolo costi e margini: OK usare "Prezzo al chilo" (es. quando unità = kg).
 */

/** Label per il campo prezzo in form Creazione ingredienti (prezzo unitario, non al peso). */
export const CREAZIONE_INGREDIENTI_PREZZO_LABEL = "Prezzo unitario"

/** Placeholder per il campo prezzo in form Creazione ingredienti. */
export const CREAZIONE_INGREDIENTI_PREZZO_PLACEHOLDER = "Prezzo unitario (€)"

/** Label per prezzo in sezione Calcolo costi e margini (es. prezzo al chilo). */
export const CALCOLO_COSTI_MARGINI_PREZZO_AL_CHILO_LABEL = "Prezzo al chilo"
