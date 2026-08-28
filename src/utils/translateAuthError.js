/**
 * Traduce i messaggi d'errore più comuni di Supabase Auth (sempre in inglese, tecnici) in un
 * messaggio comprensibile in italiano. Senza questo, un utente finale vedeva testi come
 * "Anonymous sign-ins are disabled" o "Invalid login credentials" — trovato durante uno stress
 * test pre-produzione sul form di registrazione cliente (email vuota → quel messaggio esatto).
 *
 * Prudente per design: se il messaggio non è tra i pattern noti, ritorna quello originale
 * invece di nascondere informazioni utili al debug (meglio un messaggio in inglese visibile che
 * un errore silenzioso).
 */

const PATTERNS = [
  { test: /anonymous sign-ins? (is|are) disabled/i, msg: "Email obbligatoria per la registrazione." },
  { test: /invalid login credentials/i, msg: "Email o password non corretti." },
  { test: /email not confirmed/i, msg: "Devi confermare l'indirizzo email prima di accedere: controlla la posta (anche lo spam)." },
  { test: /user already registered/i, msg: "Esiste già un account con questa email. Prova ad accedere." },
  { test: /password should be at least/i, msg: "La password deve avere almeno 6 caratteri." },
  { test: /unable to validate email address/i, msg: "L'indirizzo email inserito non è valido." },
  { test: /email rate limit exceeded/i, msg: "Troppi tentativi con questa email: riprova tra qualche minuto." },
  { test: /over_email_send_rate_limit|rate limit/i, msg: "Troppe richieste in poco tempo: riprova tra qualche minuto." },
  { test: /same password/i, msg: "La nuova password deve essere diversa da quella attuale." },
  { test: /token has expired|invalid.*token/i, msg: "Il link non è più valido: richiedine uno nuovo." },
  { test: /network|fetch failed|failed to fetch/i, msg: "Problema di connessione: controlla la rete e riprova." },
]

/**
 * @param {unknown} err - errore da Supabase Auth (o generico)
 * @param {string} fallback - messaggio da usare se non c'è err.message
 * @returns {string}
 */
export function translateAuthError(err, fallback = "Si è verificato un errore. Riprova.") {
  const raw = err?.message ? String(err.message) : ""
  if (!raw) return fallback
  const match = PATTERNS.find((p) => p.test.test(raw))
  return match ? match.msg : raw
}
