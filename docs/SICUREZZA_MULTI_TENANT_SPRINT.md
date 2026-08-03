# Sprint sicurezza multi-tenant e affidabilità rilascio

Stato operativo dopo il ciclo hardening (agosto 2026).

## Fatto (priorità massima)

1. **Presence cross-tenant** — modulo `sql/modules/30_support_presence_tenant_bind.sql`
   - `upsert_support_presence`: tenant **solo** da `auth.uid()` (`utenti_ruoli` / `clienti`)
   - `p_tenant_id` ignorato (compat firma)
   - RLS `FORCE`, nessun grant INSERT/UPDATE/DELETE a `authenticated`
   - Heartbeat frontend non invia più tenant come autorizzazione; Super Admin non pubblica presence
   - Assert smoke: `sql/tests/30_support_presence_asserts.sql`
   - Contratto unit: `tests/unit/supportPresenceContract.test.js`

2. **Backend Nest** (`server/pizzeria-backend`)
   - Helmet attivo
   - CORS obbligatorio in production (`CORS_ORIGIN` / `FRONTEND_URL`)
   - Swagger solo con `SWAGGER_ENABLED=true`
   - Throttler globale + login 5/min + public API 60/min; health `SkipThrottle`

3. **Express legacy** — archiviato in `server/legacy-express/` (non supportato)

4. **`supabase/.temp/`** — in `.gitignore`; rimuovere dal tracking se ancora versionato (`git rm -r --cached supabase/.temp`)

## Prossimi (ordine consigliato)

| # | Tema | Note |
|---|------|------|
| A | Test RLS automatici con due tenant | CI con service role + JWT utente A/B |
| B | Migrazioni SQL versionate | Allineare `sql/modules` ↔ `supabase/migrations` + gate pre-deploy |
| C | Dati operativi fuori da localStorage | Magazzino / contabilità / bozze cassa → Supabase per dominio |
| D | Spezzare CassaPage / adminService | Moduli stato / API / UI |
| E | E2E login → ordine → pagamento | Playwright/Cypress su staging |

## Regola operativa

Ogni nuova **RPC `SECURITY DEFINER`**, policy RLS o `GRANT` è codice critico: review `@agents/security.md` + test negativo cross-tenant prima del merge.
