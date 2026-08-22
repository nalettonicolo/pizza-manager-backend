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
- **Delivery**: proof firma/foto su Storage `consegna-prove` (mod. 37), mappa live Realtime, sort nearest-neighbor, rider PWA.
- **Notifiche / fiscale**: adapter pattern Edge (stub SMTP/SMS/WA e RT/SDI); coda outbox come log; claim fiscal solo `service_role`.
- **CI keep-alive Supabase**: retry e check secret (workflow verde).
- **Macrofasi 1–5**: core completato (vedi `MACROFASI_SVILUPPO.md`); **Fase 6** = produzione hard + adapter reali.
- **2026-08-03**: hardening RPC (34–35); Realtime ordini (36); magazzino hub DB; stampa comanda web Francy; guide DNS; SA gate + Sala QA; proof Storage (37); advisor residui (38); deploy hosting produzione.
- **2026-08-20**: batch Chek-Sviluppi CA-10/11/12/14, CL-09/10, OP-07, OW-05; checkout profilo + geocode Nominatim-first; logo landing; priorità in `docs/punto-situazione/11_priorita_operative.md`.

---

## 3. Non completabile “tutto” senza input esterni

| Area | Blocco |
|------|--------|
| **Pagamenti online live** | Account Stripe **live** tenant + webhook produzione (oggi Francy ha solo `*_test_`). |
| **Registratore telematico / SDI** | Vendor RT + commercialista — adapter stub pronto. |
| **POS certificati (PAX/Ingenico)** | SDK/protocolli e ambiente hardware di test. |
| **SMTP Auth cliente** | Config Dashboard Supabase (`no-reply@pizzamanager.it`). |
| **Auth HIBP (leaked passwords)** | Piano Supabase **Pro+** (API Free rifiuta il toggle). |
| **Supporto SLA / Account manager** | Organizzazione commerciale, non repository. |
| **Dominio reale Francy** | Registrar + hostname + Firebase custom domain (guide in Go-live). |

---

## 4. Backlog tecnico per area (sintesi)

| Epic | Stato | Prossimo passo tecnico tipico |
|------|------|-------------------------------|
| **Ordini online** | WIP ~84% | Smoke Stripe **live** (stampa comanda web già ON Francy). |
| **Consegne** | WIP ~84% | VRP più ricco / signed URL retention se serve (Storage già OK). |
| **Tablet / Realtime** | WIP ~72% | Audit azione e modalità kiosk (Realtime già attivo). |
| **Magazzino** | WIP ~78% | Giacenza valorizzata / inventari (fornitori-DDT già DB). |
| **Sicurezza DB** | Avanzato | Advisor 106→43; HIBP su Pro+; rumore 0028/0029 intenzionale. |
| **API pubbliche** | Todo ~42% | Nest OAuth token su `api_oauth_clients`. |
| **Fiscale IT** | Parziale | Completare `rt-sdi.ts` quando vendor scelto. |

**Idea segnalata 2026-08-22 (non ancora implementata):** dal pannello "Paga online" in Cassa, se l'ordine è stato registrato da Cassa e il cliente ha chiesto pagamento online, aggiungere un tasto che apre WhatsApp (`https://wa.me/<numero>?text=<link>`) con il link di pagamento pre-compilato nel messaggio, oltre all'invio SMS/altro canale già previsto. Richiede solo il numero cliente (già presente nel modulo "Telefono destinatario") e il link pay-by-link già generato — nessuna nuova infrastruttura, solo un pulsante in più nel pannello esistente.

**Stati ordine delivery da rivedere (segnalato 2026-08-22, esplicitamente rimandato — "da sistemare più tardi"):** il pannello Delivery/Pony mostra "IN_PREPARAZIONE" subito dopo l'accettazione cassa. Il flusso voluto invece è:
1. Ordine ricevuto e accettato → stato "In attesa" (non ancora "in preparazione").
2. Stato passa a "In preparazione" solo quando mancano ~30 minuti all'orario di consegna previsto (transizione basata sul tempo, non sull'accettazione).
3. Gli stati successivi ("In forno" / "In consegna") restano affidati ai tablet operativi (cucina/pizzaioli) o al pony che prende in carico la consegna — non cambia.
Richiede probabilmente un nuovo stato intermedio (o un calcolo a display basato su `consegna_prevista_at - now()`) sul pannello Delivery — da progettare con calma, non un fix immediato.

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
| Canvas Cursor / Guide SA | `docs/punto-situazione/` · slug `punto-situazione-*` |

---

*Ultima revisione: 2026-08-03*
