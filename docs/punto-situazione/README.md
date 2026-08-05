# Punto della situazione — per settore (agenti)

**Data revisione:** 2026-08-05  
**Sostituisce:** `docs/PUNTO_SITUAZIONE_WEBAPP_COMPLETA.md` (rimosso)

Ogni documento è prodotto secondo il profilo in `agents/*.md`.  
Verdetto: **[10 — Supervisore](./10_supervisor.md)** → **APPROVATO** (post `41caf48` + ciclo P0–P4 in working tree).

| # | Settore | Agente | File |
|---|---------|--------|------|
| 01 | Architettura | `architecture.md` | [01_architettura.md](./01_architettura.md) |
| 02 | Prodotto / operazioni | `product.md` | [02_prodotto.md](./02_prodotto.md) |
| 03 | Database / SQL / RLS | `database.md` | [03_database.md](./03_database.md) |
| 04 | Code (React) | `code.md` | [04_code.md](./04_code.md) |
| 05 | UI / UX | `ui.md` | [05_ui.md](./05_ui.md) |
| 06 | Dataflows | `dataflows.md` | [06_dataflows.md](./06_dataflows.md) |
| 07 | Security | `security.md` | [07_security.md](./07_security.md) |
| 08 | Test / QA | `test.md` | [08_test.md](./08_test.md) |
| 09 | Copywriter | `copywriter.md` | [09_copywriter.md](./09_copywriter.md) |
| 10 | Supervisore | `supervisor.md` | [10_supervisor.md](./10_supervisor.md) |
| 11 | Priorità operative | (supervisore + team) | [11_priorita_operative.md](./11_priorita_operative.md) |

## Snapshot 2026-08-05

- **SQL:** mod. 39 + **40** (whitelist PO pubbliche).
- **Code:** cassa facade/hook/display; `parametriService`; Stripe admin service; adapter email/SMS/WA/RT.
- **QA:** 75 unit; E2E pubblico; lint 0 errori.
- **Aprire:** [11_priorita_operative.md](./11_priorita_operative.md) e [GO_LIVE_FRANCY_RUNBOOK.md](../GO_LIVE_FRANCY_RUNBOOK.md).

## Come aggiornare

1. Una feature alla volta → ciclo agenti (`agents/README.md`).
2. Aggiornare **solo** i file di settore toccati.
3. Chiudere col supervisore (`APPROVATO` / `BLOCCATO`).
4. Guide SA: slug `punto-situazione-*`.

## Correlati

- `docs/MACROFASI_SVILUPPO.md`, `docs/BACKLOG_E_STATO_SVILUPPO.md`, `docs/DEBT_MONOLITH_PLAN.md`
- `docs/ARCHITETTURA_E_STATO.md`, `docs/QA_CHECKLIST_SMOKE.md`
