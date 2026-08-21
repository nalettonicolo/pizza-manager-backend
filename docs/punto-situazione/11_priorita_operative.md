# Priorità operative — 2026-08-20

| Priorità | Voce | Stato |
|----------|------|--------|
| **P0** | Whitelist PO RPC pubbliche (mod. 40) | **Fatto** (in `schema_completo`; verify:public-po) |
| **P1** | Chek-Sviluppi batch CA/CL/OP/OW (ago) | **Fatto codice** — smoke manuale residuo |
| **P1** | Unit + Demo live checklist | **Fatto** |
| **P2** | Stripe TEST / live Francy | UI + Edge; **chiavi + smoke pagamento** |
| **P2** | Dominio menu Francy | Runbook; **blocco DNS** |
| **P3** | HIBP | Runbook; **Pro+** |
| **P3** | Adapter email/SMS/WA/RT | **Codice fatto**; blocco secrets |
| **P4** | RLS CI + E2E | **Parziale** (JWT/auth secrets) |
| **P4** | Debito monolite / localStorage→DB | **Opzionale** a slice |

## Batch Chek-Sviluppi (2026-08-07 → 08)

| Codice | Esito |
|--------|--------|
| CA-10 / CA-11 | Catalogo pagamenti + stampa operativa fuori cassa → Admin |
| CA-12 | Solo parametri operativi in cassa + audit `parametri_cassa_operatore` |
| CA-14 | Planning: strip pony (anche a 0), ↑↓ corretto |
| CL-09 | Affinità ingredienti suggeriti in modifica pizza |
| CL-10 | Checkout: riepilogo profilo, Conferma non silenziosa, Stripe soft |
| OW-05 | Allineato a CL-10 + area carte test (smoke manuale) |
| OP-07 | Quad Bancone/Delivery: dati + empty state chiari |
| UX brand | Logo `logo-pizzamanager.png` in header/footer landing |

## Qualità gate

```bash
npm run lint
npm run test:all          # node test + vitest (~93 unit)
npm run deploy:hosting:ci # lint + test + build + Firebase
npm run verify:public-po
npm run verify:stripe-edge
```

## Prossimo passo operativo team

1. **Commit** working tree accumulato (ancora dirty) + push.
2. Smoke **CL-10** / **OW-05** su https://pizzamanager.it (carta test).
3. Go-live Francy: `docs/GO_LIVE_FRANCY_RUNBOOK.md` (chiavi Stripe, DNS).
4. Backup locale: `D:\APP_PIZZERIA\pizzamanager_backup_20_08_2026` (copia completa 2026-08-20).

SQL: moduli **39–41** consolidati in `schema_completo` (non più in `sql/modules/`); pendenti **18–38** e **42–50**.

Verdetto base: **APPROVATO** al 2026-08-05 — vedi `10_supervisor.md`. Aggiornamento operativo: **questa pagina** (2026-08-20).
