# Punto della situazione — per settore (agenti)

**Data revisione:** 2026-08-21 (delta su base 2026-08-05)  
**Sostituisce:** `docs/PUNTO_SITUAZIONE_WEBAPP_COMPLETA.md` (rimosso)

Ogni documento è prodotto secondo il profilo in `agents/*.md`.  
Verdetto base: **[10 — Supervisore](./10_supervisor.md)** → **APPROVATO** (2026-08-05).  
**Priorità aggiornate:** **[11 — Priorità operative](./11_priorita_operative.md)** → **2026-08-20**.  
**Sintesi enterprise:** **[12 — Management](./12_enterprise_management.md)** → **2026-08-21**.

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
| 12 | Enterprise (tech+marketing+IT) | (sintesi management) | [12_enterprise_management.md](./12_enterprise_management.md) ← **2026-08-21** |

## Snapshot 2026-08-21

- **Rischio trovato non richiesto:** working tree non committato da 16 giorni, con codice già live in produzione (edge function OAuth/delivery/SumUp, moduli SQL 42–52) — vedi [12_enterprise_management.md](./12_enterprise_management.md).
- **Sessione rider/OAuth/tavoli/colori prep:** rider posizione+auto-assegnazione, OAuth partner API, backend tavoli, kiosk auto-logout, colori preparazione unificati Cucina/Bancone/Pizzaiolo, CSV ingredienti senza colonna colore, realtime Cassa/Pony, fix bug `turni_cassa_apri`.
- **Aprire:** [12_enterprise_management.md](./12_enterprise_management.md) e `docs/QA_CHECKLIST_SMOKE.md` (sezione "Novità sessione 20–21/08").

## Snapshot 2026-08-20

- **Chek-Sviluppi:** batch CA-10/11/12/14, CL-09/10, OP-07, OW-05 in codice; UI Completate collassabile; nome pagina Chek-Sviluppi.
- **Checkout cliente:** riepilogo dati profilo (no textarea); geocode Nominatim-first; Conferma non silenziosa.
- **Admin:** Pagamenti online (catalogo sistemi); Stampa operativa (flusso + layout comanda).
- **Brand:** logo `src/assets/logo/logo-pizzamanager.png` in header/footer landing.
- **Hosting:** deploy Firebase effettuati (bundle post CL-10 / logo).
- **Backup:** `D:\APP_PIZZERIA\pizzamanager_backup_20_08_2026` (copia completa).
- **Aprire:** [11_priorita_operative.md](./11_priorita_operative.md) e [GO_LIVE_FRANCY_RUNBOOK.md](../GO_LIVE_FRANCY_RUNBOOK.md).

## Come aggiornare

1. Una feature alla volta → ciclo agenti (`agents/README.md`).
2. Aggiornare **solo** i file di settore toccati.
3. Chiudere col supervisore (`APPROVATO` / `BLOCCATO`).
4. Guide SA: slug `punto-situazione-*`.

## Correlati

- `docs/MACROFASI_SVILUPPO.md`, `docs/BACKLOG_E_STATO_SVILUPPO.md`, `docs/DEBT_MONOLITH_PLAN.md`
- `docs/ARCHITETTURA_E_STATO.md`, `docs/QA_CHECKLIST_SMOKE.md`
- Super Admin → **Chek-Sviluppi** (`/superadmin/checklist-mese`) e **Roadmap** (`/superadmin/sviluppo`)
