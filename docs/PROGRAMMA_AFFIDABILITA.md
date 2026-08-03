# Programma affidabilità PizzaManager

Obiettivo: trasformare la ricchezza funzionale in **affidabilità verificabile**
prima di scalare il numero di clienti. Riferimento: valutazione complessiva 2026-08.

## Stato Fase A (fondamenta bloccanti) — avviata 2026-08-02

| Voce | Stato |
|------|--------|
| Presence cross-tenant (modulo 30) | Applicato su DB remoto + assert |
| `search_path` su SECURITY DEFINER (modulo 31) | Applicato (batch public/core/admin) |
| Nest unico backend | Express in `server/legacy-express/` DEPRECATED |
| Nest hardening | Helmet, CORS prod, Swagger opt-in, Throttler |
| `supabase/.temp` | Ignorato / untracked |
| Migrazioni versionate | Avvio in `supabase/migrations/` (29–31) |
| Matrice ruoli × tenant | `sql/scripts/matrice_ruoli_tenant_azioni.sql` |
| npm audit | Frontend: high risolte (restano 2 moderate react-router → v7 pianificato). Nest: build ok; restano avvisi su js-yaml via @nestjs/swagger (aggiornamento major controllato) |

Dettaglio presence: `docs/SICUREZZA_MULTI_TENANT_SPRINT.md`.

## Fasi

### A — Fondamenta (2–3 settimane) — IN CORSO
1. Baseline SQL + migrazioni timestampate (`sql/modules` ↔ `supabase/migrations`)
2. Hardening multi-tenant dimostrabile (RLS JWT A/B in CI)
3. Dipendenze vulnerabili aggiornate con regressione
4. Nest unico + env CORS/Helmet/Swagger/rate-limit verificati in staging
5. Backup/restore documentato + smoke DB pre-deploy
6. Matrice ruoli × tenant × azioni eseguita su staging

### B — Dati affidabili (3–5 settimane)
- Migrare ordini/contabilità/magazzino/HR/checklist fuori da localStorage
- Audit log, import/export, errori espliciti
- Classificazione: transazionali / audit / cache / preferenze / bozze

### C — Esperienza operativa (4–6 settimane)
- Spezzare CassaPage / adminService
- E2E cassa/cucina/bancone/delivery
- Planning capacità reale; UX tablet; budget performance

### D — Scala e governance
- Release train + rollback; observability; feature flag per tenant; KPI

## Gate rilascio (minimo)

- [ ] `npm run ci:frontend` verde
- [ ] Nest build/test verde
- [ ] Moduli SQL nuovi applicati e elencati in `sql/sql_upgrade.sql`
- [ ] Smoke: `sql/scripts/smoke_rls_cross_tenant.sql` su staging
- [ ] Nessun `SECURITY DEFINER` senza `search_path` (post modulo 31)
- [ ] Swagger non esposto in produzione (`SWAGGER_ENABLED` unset/false)
- [ ] `CORS_ORIGIN` impostato in produzione

## Autorità dati (decisione)

| Dominio | Autorità |
|---------|----------|
| Auth utenti / sessioni | Supabase Auth (+ Nest JWT dove già integrato) |
| Isolamento tenant / RLS / RPC ordini | **PostgreSQL / Supabase** |
| API pubbliche vetrina (stacco) | Nest `/api/public/*` verso RPC |
| Webhook Stripe / worker notifiche | Edge Functions + outbox DB |
| Preferenze UI / bozze non condivise | localStorage ammesso |
| Dati economici, HR, magazzino, workflow | **Solo DB** (obiettivo Fase B) |
