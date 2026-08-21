# APPROVATO

**Supervisore PizzaManager** — valutazione al **2026-08-05**  
Base: commit `41caf48` + lavoro non ancora committato (mod. **40**, refactor Cassa/admin, adapter notifiche, test/CI).

Agente: **solo Supervisore** (`@agents/supervisor.md`).

---

## Contesto valutato

- Hardening **34–39** in produzione/documentato; mod. **40** whitelist `parametri_operativi` applicato remoto e verificato (`verify:public-po`).
- Ciclo priorità P0–P4 **implementabile a vuoto**: chiuso (test, runbook, adapter HTTP, smoke RLS/E2E, debito monolite fase 1–2).
- Lint: **0 errori** (restano solo warning hooks preesistenti, non bloccanti).
- Unit: **75/75** Vitest; Playwright pubblico 5 OK + auth SKIP senza secrets.

---

## Motivazione (APPROVATO)

### Architettura / code
- Facade ordini cassa (`cassaOrdiniService`), hook `useCassaModificaOrdine`, display delivery estratto.
- `parametriService` + `onlinePaymentsAdminService` spezzano `adminService` senza cambiare contratti UI.
- Stub `cassaService` deprecato (niente insert diretti fuori RPC).

### Security
- Mod. **40** chiude l’esposizione blob operativo ad anon (follow-up del supervisore 2026-08-04).
- Adapter email/SMS/WhatsApp/RT: codice generico HTTP; produzione ancora bloccata da **secrets**.
- Inventario RLS esteso PASS (policy core, riga_ordine, support_presence, Stripe anon no EXECUTE).

### Test / qualità
- Checklist Demo live in `QA_CHECKLIST_SMOKE.md`.
- Script: `verify:public-po`, `verify:stripe-edge`, `verify:rls-inventory`, `verify:rls-jwt-ab`.
- Workflow GitHub `security-smoke.yml` / `e2e-smoke.yml`.

### Residui **non** BLOCCATO
| Voce | Dipendenza |
|------|------------|
| Stripe **live** Francy | Chiavi + smoke pagamento |
| Dominio menu Francy | DNS + Firebase + Auth redirects |
| HIBP | Supabase Pro+ |
| Invio reale email/SMS/WA/RT | Secrets Edge + vendor |
| RLS JWT A/B in CI | Secrets `RLS_JWT_*` |
| Commit + deploy hosting | Azione team (working tree ancora dirty) |
| Slice ulteriori `adminService` / localStorage→DB | Debito opzionale |

---

## Condizioni post-APPROVATO

1. Commit + push del lavoro accumulato; deploy hosting quando pronto.
2. Go-live Francy: seguire `docs/GO_LIVE_FRANCY_RUNBOOK.md`.
3. Nuove RPC DEFINER: sempre REVOKE/grant + assert tenant.
4. Continuare debito monolite solo a slice piccoli con unit.

---

## Sintesi

**APPROVATO** lo stato prodotto/tecnico al 2026-08-05: priorità codice chiuse, security mod.40 attiva, qualità (lint/test/smoke) verde; residui = esterni + commit/deploy.

---

## Delta operativo (2026-08-20) — non riesame Supervisore

Batch **Chek-Sviluppi** (CA-10/11/12/14, CL-09/10, OP-07, OW-05), logo landing, checkout profilo, deploy hosting, backup locale completo. Priorità aggiornate in `11_priorita_operative.md`. Residui aperti: **commit/push**, smoke Stripe TEST/live Francy, DNS menu.

---

*Documento Supervisore — 2026-08-05 · delta note 2026-08-20*
