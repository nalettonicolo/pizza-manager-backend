# Piano incrementale — debito monolitico (P4)

Obiettivo: ridurre `CassaPage.jsx` (~4k righe) e `adminService.js` senza big-bang refactor.

---

## Fase 0 — Fatto (2026-08-04)

- [x] Estrazione `splitNomeDaIndirizzoConsegna` → `cassa/utils/cassaDeliveryNomeIndirizzo.js` + unit test.
- [x] Costanti whitelist PO pubbliche → `src/constants/publicParametriOperativiKeys.js` + test.

---

## Fase 1 — Cassa

| Estrazione | Destinazione | Stato |
|------------|--------------|--------|
| Display delivery | `cassa/utils/cassaDeliveryDisplay.js` | **Fatto** |
| Stato modale modifica ordine | `cassa/hooks/useCassaModificaOrdine.js` | **Fatto** |
| Facade fetch/API ordini | `cassa/services/cassaOrdiniService.js` | **Fatto** (re-export da adminService) |
| Stub pericoloso `cassaService` insert diretto | deprecato → punta a RPC | **Fatto** |

**DoD:** `npm run test:unit` verde + smoke multi-reparto § Cassa.

---

## Fase 2 — adminService

| Estrazione | Destinazione | Stato |
|------------|--------------|--------|
| Stripe / pagamenti online | `onlinePaymentsAdminService.js` | **Fatto** |
| Tenant settings / parametri | `parametriService.js` (+ `patchTenantParametriOperativi`) | **Fatto** |
| Magazzino / contabilità / fidelity | slice dedicati | Prossimo |
| Target &lt; ~800 righe `adminService` | re-export barrel | In corso |

---

## Fase 3 — localStorage → DB

| Dato | Target |
|------|--------|
| Preferenze layout operative ephemeral | tabella tenant-scoped o `parametri_operativi` chiavi UI |
| Override demo `support_tenant` | già sessionStorage — OK per SA demo |

Priorità bassa finché non impatta multi-device staff.

---

## Non in scope automatico

- Rewrite completo Cassa in micro-frontend.
- Rimozione Nest backend senza audit `@agents/architecture.md`.

---

*Riferimento: `docs/punto-situazione/04_code.md`, priorità P4 in `11_priorita_operative.md`*
