/**
 * Verifica del chiamante per le Edge Function schedulate (cron/worker).
 *
 * Contesto (audit sicurezza): i job pg_cron chiamano queste funzioni passando la ANON key
 * (pubblica, presente nel bundle). Con verify_jwt=true di default, qualunque possessore della
 * anon key — cioè chiunque — potrebbe invocarle e innescare azioni privilegiate (invio email,
 * riconciliazioni, proposte di calibrazione) → abuso/costi/DoS (OWASP A01/A05).
 *
 * Difesa: un segreto condiviso passato in header `x-cron-secret`, confrontato con l'env CRON_SECRET.
 *
 * Rollout SENZA downtime (enforce-if-configured): se CRON_SECRET NON è impostato, la funzione
 * continua a funzionare (nessun blocco) — così si può deployare prima e attivare il segreto dopo.
 * Appena CRON_SECRET è impostato negli Edge secrets, l'header diventa OBBLIGATORIO.
 *
 * @returns Response 401 se la verifica fallisce, altrimenti null (proseguire).
 */
export function assertCronCaller(req: Request): Response | null {
  const expected = (Deno.env.get("CRON_SECRET") || "").trim()
  if (!expected) {
    // Secret non ancora configurato: non bloccare (fase di rollout).
    return null
  }
  const provided = (req.headers.get("x-cron-secret") || "").trim()
  if (provided && timingSafeEqual(provided, expected)) {
    return null
  }
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

/** Confronto a tempo costante per non esporre il segreto a timing attack. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
