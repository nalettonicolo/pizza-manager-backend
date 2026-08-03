# Macrofasi sviluppo PizzaManager

Piano operativo per completare la piattaforma **fase per fase**. Allineato a `BACKLOG_E_STATO_SVILUPPO.md` e `serviziRoadmapSteps.js`.

---

## Panoramica

| Fase | Nome | Obiettivo | DoD sintetico | Stato |
|------|------|-----------|---------------|-------|
| **1** | Go-live piattaforma | Produzione stabile, DB e auth | Deploy OK, SQL, preview/menu, Auth | ✅ Completata |
| **2** | Cliente end-to-end | Area cliente post-ordine | Storico, profilo geo, checkout→ordini | ✅ Completata |
| **3** | Back-office persistente | Admin su Supabase | Magazzino 14, contabilità 16, incassi DB | ✅ Completata |
| **4** | Operativo & consegne | Sala, rider, notifiche | Delivery, rider PWA, outbox notifiche | ✅ Completata (core) |
| **5** | Piattaforma enterprise | Superadmin, billing, DR | Catalogo SA DB, offline queue, fiscal export | ✅ Completata (core) |
| **6** | Produzione hard | Stripe live, Realtime, magazzino, adapter | Smoke prod + Realtime + magazzino DB | 🟡 In corso |

**Regola:** ogni patch SQL in `sql/modules/` va applicata subito con `npm run sql:apply -- sql/modules/NN_*.sql`.

---

## Fasi 1–5 (sintesi)

1. **Go-live** — moduli 14–20, deploy hosting, Auth redirect  
2. **Cliente** — RPC ordini, profilo mappa, fidelity UI  
3. **Back-office** — magazzino/contabilità/incassi su DB + `importLocalIfDbEmpty`  
4. **Operativo** — delivery stati, rider PWA, worker notifiche, capacity forno (25)  
5. **Enterprise core** — catalogo SA, offline cassa, fiscal outbox stub, OAuth clients stub  

Dettaglio storico: commit recenti + `docs/GO_LIVE_ORDINI_WEB.md`.

---

## Fase 6 — Produzione hard (in corso)

### Fatto (agg. 2026-08-03 pomeriggio)

| Filo | Stato |
|------|--------|
| Hardening grant RPC (mod. 34–35) + search_path `pm_*` | ✅ |
| Residui advisor (mod. **38**: policy `turni_operatori`, search_path storage) | ✅ |
| Segreti Stripe / `edge_*` / fiscal: solo `service_role` | ✅ verificato |
| **B** Realtime `core.ordini` (mod. 36) + Cucina/Bancone/Pizzaiolo/Delivery/Mappa | ✅ |
| **C** Magazzino fornitori/DDT su Supabase (tabelle ok, UI hub aggiornata) | ✅ |
| Proof delivery → Storage `consegna-prove` (mod. 37) | ✅ |
| **A** Stampa comanda web automatica su Francy | ✅ |
| **A** Stripe **live** smoke | ⏸ solo chiavi **test** su Francy |
| Guide DNS per host (Register, Aruba, …) + CTA sito esterno | ✅ in produzione |
| SA gate privacy + Sala QA multi-finestra | ✅ in produzione |
| Deploy hosting + push GitHub (`f005920` + delta 38) | ✅ |

Advisor sicurezza: **106 → 43** WARN (42 rumore atteso vetrina/staff; 1 HIBP richiede piano Pro+).

### Prossimi (ordine)

1. **Stripe live** su Francy (quando ci sono `pk_live` / `sk_live` / `whsec`) + smoke pagamento  
2. Go-live **dominio reale** Francy (DNS + Firebase custom domain + Auth redirects)  
3. Adapter SMTP / RT-SDI (quando ci sono credenziali vendor)  
4. Auth HIBP leaked passwords (upgrade Supabase Pro+ → toggle Dashboard)

---

*Ultima revisione: 2026-08-03*
