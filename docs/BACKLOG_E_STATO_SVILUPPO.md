# Backlog e stato sviluppo (vista engineering / product)

Questo documento fissa **cosa è realistico completare in codice**, cosa è **bloccato da dipendenze esterne**, e cosa resta **multi‑sprint / multi‑quarter**. Non sostituisce la tabella commerciale in `src/config/serviziRoadmapSteps.js` (percentuali per servizio), ma la contestualizza.

---

## 1. Principi (da SDM)

| Principio | Implicazione |
|-----------|----------------|
| **Nessun “big bang”** | Le voci enterprise (RT, POS certificati, offline DR, API pubbliche, SSO) richiedono mesi e spesso vendor/fornitori. |
| **Database prima** | Ogni feature che tocca RPC/viste deve essere riflessa su Supabase: baseline `sql/schema_completo_pizzamanager.sql` per ambienti nuovi; patch in `sql/sql_upgrade.sql` per il delta. |
| **Fonte di verità roadmap UI** | `SERVIZI_ROADMAP_STEPS` in `serviziRoadmapSteps.js` — aggiornare `nota`/`resto` quando si consegna qualcosa di verificabile. |
| **Definition of Done** | Per una feature “chiusa”: codice + migration (se serve) + comportamento verificabile in staging o checklist manuale. |

---

## 2. Completato di recente (repo, verificabile)

- **Modulo SQL 25**: web `IN_ATTESA` Stripe, capacity forno (`vetrina_slot_carico_oggi` + assert), antifraud (8/ora + blocklist), proof delivery (`consegna_prova`), stub `api_oauth_clients`.
- **Checkout vetrina**: blocco fasce piene; Stripe checkout path sbloccato lato RPC.
- **Delivery**: proof firma/foto, mappa live `/operative/delivery/mappa`, sort nearest-neighbor, rider PWA.
- **Notifiche / fiscale**: adapter pattern Edge (stub SMTP/SMS/WA e RT/SDI); coda outbox come log.
- **CI keep-alive Supabase**: retry e check secret (workflow verde).
- **Macrofasi 1–5**: core completato (vedi `MACROFASI_SVILUPPO.md`); **Fase 6** = produzione hard + adapter reali.
- **2026-08-03**: hardening RPC grants (34–35); Realtime ordini (36) su cucina/bancone/pizzaiolo/delivery; magazzino fornitori/DDT DB; stampa comanda web Francy; guide DNS host in Go-live; SA gate privacy.

---

## 3. Non completabile “tutto” senza input esterni

| Area | Blocco |
|------|--------|
| **Pagamenti online live** | Account Stripe **live** tenant + webhook produzione (oggi Francy ha solo `*_test_`). |
| **Registratore telematico / SDI** | Vendor RT + commercialista — adapter stub pronto. |
| **POS certificati (PAX/Ingenico)** | SDK/protocolli e ambiente hardware di test. |
| **SMTP Auth cliente** | Config Dashboard Supabase (`no-reply@pizzamanager.it`). |
| **Supporto SLA / Account manager** | Organizzazione commerciale, non repository. |
| **Dominio reale Francy** | Registrar + hostname + Firebase custom domain (guide in Go-live). |

---

## 4. Backlog tecnico per area (sintesi)

| Epic | Stato | Prossimo passo tecnico tipico |
|------|------|-------------------------------|
| **Ordini online** | WIP ~84% | Smoke Stripe **live** + verifica stampa comanda web. |
| **Consegne** | WIP ~84% | Proof su Storage (mod. 37); VRP più ricco se serve. |
| **Tablet / Realtime** | WIP ~72% | Realtime attivo; audit azione e kiosk. |
| **Magazzino** | WIP ~78% | Giacenza valorizzata / inventari (fornitori-DDT già DB). |
| **API pubbliche** | Todo ~42% | Nest OAuth token su `api_oauth_clients`. |
| **Fiscale IT** | Parziale | Completare `rt-sdi.ts` quando vendor scelto. |

---

## 5. Ordine di lavoro consigliato (ora)

1. **Stripe live** Francy (chiavi) + smoke pagamento web.
2. **Dominio menu** Francy (DNS + Firebase + Auth redirects).
3. Adapter SMTP / RT-SDI quando ci sono credenziali.
4. Enterprise: billing Stripe tenant / OAuth quando in scope.

---

## 6. Riferimenti

| Documento | Contenuto |
|-----------|-----------|
| `docs/MACROFASI_SVILUPPO.md` | Macrofasi 1–5 done, Fase 6. |
| `docs/GO_LIVE_ORDINI_WEB.md` | Produzione oggi senza adapter. |
| `src/config/serviziRoadmapSteps.js` | Percentuali UI Super Admin. |
| `src/content/dnsHostGuides.js` | Guide DNS per registrar. |
| Canvas Cursor | `punto-situazione-supervisore.canvas.tsx` |

---

*Ultima revisione: 2026-08-03*
