# Roadmap velocità di lavoro (agente + team)

Obiettivo: **meno round-trip, meno pipeline inutili, feature chiuse in ore non in giorni**.  
Non sostituisce il backlog prodotto (`BACKLOG_E_STATO_SVILUPPO.md`); regola **come** si lavora.

---

## Principio (sempre)

| Modalità | Cosa fare | Cosa non fare |
|----------|-----------|---------------|
| **Fix / copy / UI** | Solo file toccati + verifica mirata | `ci:frontend`, deploy, e2e |
| **Feature piccola** | Codice + 1–3 unit test | Commit/push/deploy senza richiesta |
| **Feature + go-live** | Test → commit → push → deploy (solo a richiesta esplicita) | “Completo” di default |

**Prompt utili (copia-incolla):**
- `solo codice, no test no deploy`
- `fix rapido: <file o schermata>`
- `quando finito: commit + push + deploy hosting`

---

## Fase V0 — Operativa oggi (0–2 giorni)

Checklist che riduce subito il tempo per turno:

1. **Una feature per chat** — niente “e anche X/Y/Z” nello stesso messaggio.
2. **Ancoraggio** — indicare path (`CassaImpostazioniPage`) o URL (`/operative/turni`).
3. **Deploy on-demand** — hosting/Koyeb solo se scritto esplicitamente.
4. **Test on-demand** — di default: `npx vitest run <file.test.js>`; `test:all` / e2e solo pre-release.
5. **SQL** — un modulo per sessione; apply subito; niente schema rewrite.

**DoD V0:** ogni messaggio utente ha scope ≤ 1 area (cassa | admin | SA | docs).

---

## Fase V1 — Debito che rallenta (1–2 settimane)

Priorità **tecnica** (velocità sviluppo), non prodotto:

| # | Voce | Perché accelera | Esito |
|---|------|-----------------|-------|
| 1 | Split residuo `CassaPage` (hook/servizi già avviati) | Diff e review più corti | File < ~800–1000 righe per pezzo critico |
| 2 | Continuare estrazione da `adminService` (pattern `parametriService` / `onlinePayments*`) | Meno grep/carico contesto | Nuove API in moduli dedicati |
| 3 | Test unit **accanto** al cambio (non batch a fine giornata) | Fallimenti localizzati | `test:unit` solo file toccati in ciclo tipico |
| 4 | Smoke e2e **pubblico** in CI; auth e2e solo con secret | CI non blocca su login | Già avviato (`e2e-smoke.yml`) |

**DoD V1:** una PR tipica tocca ≤ ~15 file; review agent < 2 pass di tool “esplorazione ampia”.

---

## Fase V2 — Rotaie di rilascio (2–4 settimane)

| # | Voce | Perché accelera |
|---|------|-----------------|
| 1 | Script `deploy:hosting:ci` solo post-merge o su richiesta | Separare “sviluppo” da “pubblicazione” |
| 2 | Gate pre-deploy corto: `lint` (0 error) + `vitest run` path toccati + `build` | Evitare CI full su ogni fix |
| 3 | Checklist go-live tenant in runbook (Francy già in `GO_LIVE_FRANCY_RUNBOOK.md`) | Meno chat di “cosa manca” |
| 4 | Documentare in `procedere da qui.txt` solo **prossimo tick** (max 5 voci) | Evitare roadmap-fantasma |

**DoD V2:** da “fix pronto” a live ≤ 15 min di comandi, senza riesplorare il repo.

---

## Fase V3 — Prodotto senza frizione (continuo)

Ordine consigliato (allineato a `procedere da qui` Fase C, ma a pezzi piccoli):

1. Slot capacità / planning cassa (impatto sala)
2. Cucina↔bancone stato colori su DB
3. Delivery flusso atomico
4. Zero gergo tecnico residuo in UI gestore

Ogni voce = **1 chat = 1 DoD verificabile** (es. “slot 15 min in riepilogo conferma”).

---

## Cosa chiedere all’agente (matrice)

| Vuoi… | Scrivi… |
|-------|---------|
| Patch veloce | `solo codice, no deploy` |
| Chiusura giornata | `commit + push` (deploy a parte se serve) |
| Produzione aggiornata | `deploy hosting` oppure `deploy completo` |
| Capire stato | `punto situazione 5 righe` (no riscrittura docs) |

---

## Anti-pattern (da evitare)

- “Test completo + deploy completo” su ogni micro-fix  
- Aprire 10 file di docs punto-situazione senza bisogno  
- Feature + refactor monolite + SQL + CI nella stessa sessione  
- Esplorazione Task/subagent se il path è già noto  

---

## Metriche semplici (opzionale)

- Tempo medio chat → PR/commit: target **< 30 min** per fix UI/copy  
- Deploy solo **N volte/giorno** pianificate (es. fine mattina / sera)  
- File medi per commit feature: target **< 20**

Aggiornare questa roadmap quando cambia il collo di bottiglia (oggi: monolite cassa + pipeline full su richiesta ampia).
