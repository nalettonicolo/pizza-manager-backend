# Backlog e stato sviluppo (vista engineering / product)

Questo documento fissa **cosa è realistico completare in codice**, cosa è **bloccato da dipendenze esterne**, e cosa resta **multi‑sprint / multi‑quarter**. Non sostituisce la tabella commerciale in `src/config/serviziRoadmapSteps.js` (percentuali per servizio), ma la contestualizza.

---

## 1. Principi (da SDM)

| Principio | Implicazione |
|-----------|----------------|
| **Nessun “big bang”** | Le voci enterprise (RT, POS certificati, offline DR, API pubbliche, SSO) richiedono mesi e spesso vendor/fornitori. |
| **Database prima** | Ogni feature che tocca RPC/viste deve avere migration applicata su Supabase (vedi `sql/sql_upgrade.sql` e `supabase/migrations/`). |
| **Fonte di verità roadmap UI** | `SERVIZI_ROADMAP_STEPS` in `serviziRoadmapSteps.js` — aggiornare `nota`/`resto` quando si consegna qualcosa di verificabile. |
| **Definition of Done** | Per una feature “chiusa”: codice + migration (se serve) + comportamento verificabile in staging o checklist manuale. |

---

## 2. Completato di recente (repo, verificabile)

- **Turni cassa**: RPC `turni_cassa_*`, tabella `turni_operatori` (se mancante), parametro `cassa_turno_obbligatorio`, gate checkout Cassa.
- **Ordine ↔ turno**: `core.ordini.turno_operatori_id`, `create_order_with_items(..., p_turno_operatori_id)`, Cassa passa l’id turno; dettaglio ordine mostra PV e turno quando presenti.
- **Registratore Super Admin**: fix hooks React (#310) su `SuperadminRegistratoreCassaPage` (`useMemo` prima di `if (!ready)`).
- **DB edge cases**: FK `punti_vendita` solo se tabella base; `sql_upgrade` allineato.
- **Cassa enterprise (realizzabile)**: tabella `cassa_ordine_audit` + RPC `cassa_audit_log`; in app: log su checkout ok/errore/fuori area; pagamento misto a righe illimitate (max 15 UI); parametro `cassa_arrotonda_5_cent`; sconto globale a cassa con riga in nota `[Sconto cassa €…]`; telemetria console + hook opzionale `window.__CASSA_TELEMETRY_HOOK__`.

---

## 3. Non completabile “tutto” senza input esterni

| Area | Blocco |
|------|--------|
| **Pagamenti online** | Gateway reale (Stripe/SumUp), edge function, webhook, PCI — serve account e scelta prodotto. |
| **Registratore telematico / SDI** | Dispositivo o middleware certificato, normativa, commercialista — non solo codice. |
| **POS certificati (PAX/Ingenico)** | SDK/protocolli e ambiente hardware di test. |
| **Supporto SLA / Account manager** | Organizzazione commerciale, non repository. |
| **Penetration test periodici** | Team security o fornitore esterno. |

Questi restano **backlog prodotto** con owner business + engineering, non task “da chiudere in un branch”.

---

## 4. Backlog tecnico per area (sintesi)

| Epic | Stato | Prossimo passo tecnico tipico |
|------|------|-------------------------------|
| **Cassa (ordini_cassa)** | Avanzato | Audit + misto multi-riga + arrotondamento 5 ct + telemetria leggera in codice; integrazione Sentry/OTel resta opzionale. |
| **Offline / DR** | Non iniziato | Coda IndexedDB + sync idempotente + policy conflitti — dopo stabilità RPC cassa. |
| **Ordini online** | WIP | Gateway; anti‑frode; notifiche se non coperte da stampa comanda automatica. |
| **Consegne** | Todo | Stati rider, SLA, app rider — grande incremento. |
| **Multi‑PV / report gruppo** | Parziale | PV su ordine; report consolidato e permessi gruppo — backlog dedicato. |
| **Magazzino / contabilità** | Parziale | Migrazione dati localStorage → Supabase dove previsto. |
| **API pubbliche** | Todo | OpenAPI, OAuth, rate limit — piattaforma dedicata. |

Dettaglio testuale per servizio: `resto` in `serviziRoadmapSteps.js`.

---

## 5. Ordine di lavoro consigliato (allineato a `ROADMAP_CASSA_ENTERPRISE.md`)

1. **Fase 0**: applicare tutte le migration Supabase necessarie all’ambiente usato dall’app.
2. **Blocco A (cassa)**: chiudere sotto‑epic misurabili (audit, osservabilità minima, poi pagamenti misti avanzati).
3. **Blocco B (offline)**: dopo metriche e stabilità RPC.
4. **Blocco C (fiscale IT)**: modello dati + audit + integrazione vendor quando scelto.

---

## 6. Cose da fare / follow-up (prodotto & architettura)

- **Flussi “tutto nell’app” vs siti clienti su GitHub**: decidere se mantenere vetrina/ordini nel motore unico (Supabase + SPA) o quando proporre siti/landing per cliente su repo separati; trade-off branding, sync menu, costi operativi e supporto (discussione dedicata, non bloccante per lo sviluppo corrente).

---

## 7. Riferimenti

| Documento | Contenuto |
|-----------|-----------|
| `docs/ROADMAP_CASSA_ENTERPRISE.md` | Priorità cassa → offline → fiscale IT. |
| `docs/ARCHITETTURA_E_STATO.md` | Route vs implementazione. |
| `DEPLOY_COMANDI.md` | Deploy frontend/backend; migrazioni DB (sezione dedicata). |
| `sql/sql_upgrade.sql` | Script incrementali manuali. |

---

*Ultima revisione: 2026-04-05*
