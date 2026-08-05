# Test / QA — punto situazione PizzaManager

**Data:** 2026-08-05  
**Agente:** QA / Test (`@agents/test.md`)  
**Comando CI frontend:** `npm run ci:frontend` → `lint` + `test:all` + `build`

---

## 1. Unit (~75)

| Metrica | Valore |
|---------|--------|
| File unit | **18** |
| Vitest | **75** passed |
| Lint | **0 errori** (12 warning hooks preesistenti) |

Nuovi rispetto a 41caf48: split nome/indirizzo, display delivery, whitelist PO, Stripe client/admin, parametriService.

---

## 2. Smoke / E2E

- Checklist: `docs/QA_CHECKLIST_SMOKE.md` (incluso **Demo live** SA).
- Playwright pubblico: home, contatti, login, privacy, negozio.
- Playwright auth: SKIP senza `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD`.
- Verify remoto: `verify:public-po`, `verify:stripe-edge`, `verify:rls-inventory` (8 check), `verify:rls-jwt-ab` (SKIP senza JWT).

---

## 3. Gap residui

| Gap | Stato |
|-----|--------|
| E2E login → ordine → Stripe | Serve staging + secrets |
| RLS JWT A/B automatico in CI | Script pronto; secrets mancanti |
| Realtime / storage proof auto | Solo smoke manuale |
| Nest spec in pipeline hosting | Job Nest separato in `ci.yml` |

---

## 4. Verdetto Test

- Gate locale: lint (0 err) + 75 unit + E2E pubblico OK.
- Non blocca milestone prodotto; go-live Francy resta smoke manuale + chiavi.

*Agente Test — 2026-08-05*
