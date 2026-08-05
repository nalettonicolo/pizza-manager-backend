# Priorità operative — 2026-08-05

| Priorità | Voce | Stato |
|----------|------|--------|
| **P0** | Whitelist PO RPC pubbliche (mod. 40) | **Fatto** (remoto + verify) |
| **P1** | Unit split cassa + Demo live checklist | **Fatto** |
| **P2** | Stripe live Francy | Tooling/runbook; **blocco chiavi** |
| **P2** | Dominio menu Francy | Runbook; **blocco DNS** |
| **P3** | HIBP | Runbook; **Pro+** |
| **P3** | Adapter email/SMS/WA/RT | **Codice fatto**; blocco secrets |
| **P4** | RLS CI + E2E | **Parziale** (script + pubblico; JWT/auth secrets) |
| **P4** | Debito monolite | **Fase 1–2** (cassa display/hook/facade, parametri, Stripe) |

## Qualità gate (oggi)

```bash
npm run lint          # 0 errori
npm run test:unit     # 75 passed
npm run e2e:smoke     # 5 passed + 1 skipped (auth)
npm run verify:public-po
npm run verify:rls-inventory
```

## Prossimo passo operativo team

1. **Commit** working tree (mod.40, refactor, docs, CI).
2. **Deploy hosting** se serve aggiornare Firebase.
3. Go-live Francy: `docs/GO_LIVE_FRANCY_RUNBOOK.md`.

Verdetto: **APPROVATO** — vedi `10_supervisor.md`.
