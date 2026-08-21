# 12 — Punto situazione enterprise (management: tech + marketing + IT)

**Data revisione:** 2026-08-21
**Compilato da:** sintesi di 6 ricognizioni parallele (backlog tecnico, go-live/marketing, infrastruttura/sicurezza) su repo, documentazione di progetto e advisor Supabase live.
**Tesi:** il prodotto è tecnicamente pronto oltre il previsto — zero feature bloccate da codice mancante. Il go-live di Francy dipende da **9 decisioni/credenziali esterne**, non da altro sviluppo, e da un **rischio operativo trovato per caso** (non richiesto) che conviene chiudere prima di tutto il resto.

---

## ⚠️ Rischio critico trovato stasera, non richiesto

**Il codice che gira oggi in produzione non esiste su Git.** Ultimo commit su `main`: **2026-08-05** (`fix(test): allinea mock parametriService a maybeSingle`). Oggi è il 21/08: **16 giorni** senza commit, con un working tree che contiene centinaia di file modificati/nuovi — praticamente tutto `src/`, le edge function `oauth-token`/`api-v1-ordini`/`delivery-assegna-ordine-auto`/`payment-sumup-*`, i moduli SQL 42–52, planning delivery, tavoli/split-conto, pagamenti online multi-provider.

Verificato via `list_edge_functions`: `oauth-token`, `api-v1-ordini` e `delivery-assegna-ordine-auto` risultano **deployate il 20/08** (ieri) — sono **live su Supabase** ma il loro codice sorgente esiste **solo su questa macchina**, non in un commit recuperabile. Se questo PC si perde o la working copy viene sovrascritta, non c'è modo di ricostruire lo stato reale del codice in produzione dal repository.

**Priorità #1 prima di qualunque altra cosa**: commit + push del lavoro accumulato.

---

## 01 — Lente tecnica: cosa manca da completare (codice)

Sorpresa positiva: **zero feature bloccate da codice mancante**. Tutti i moduli enterprise (pagamenti, notifiche, fiscale, OAuth, tavoli, delivery) sono scritti. Quello che resta è debito tecnico da smaltire a fette, non buchi da colmare.

| Voce | Stato | Nota |
|------|-------|------|
| Monoliti `CassaPage.jsx` / `adminService.js` | Debito, non urgente | Epic 1 di `COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` li affronta a step piccoli (1.2 già estratta in repo) |
| Dati doppi localStorage vs Supabase | Debito | Magazzino, contabilità e — scoperta di stasera — il **listino piani pubblico** vivono ancora in parte nel `localStorage` del browser |
| Doppio binario auth Nest vs Supabase | Pianificato, rischio noto | `FASE_1_AUTH_E_API_SELFHOST.md`: se login Nest usa `core.users.id` e Supabase usa `auth.users.id`, gli ID possono disallinearsi — serve script di migrazione dedicato prima di attivare Nest auth ovunque |
| Naming tabelle misto (`Ordine`/`RigaOrdine` vs `core.*`) | Cosmetico, da chiarire | I log query mostrano traffico reale su `public.RigaOrdine` legacy — da confermare se è solo vista o doppio binario dati ancora attivo |

### Roadmap tecnica per area

| Area | Stato | Prossimo passo tipico |
|------|-------|------------------------|
| Ordini online | ~84% | Smoke Stripe live (stampa comanda web già ON) |
| Consegne | ~84% | VRP più ricco se serve; retention URL firmate |
| Tablet / Realtime | ~72% | Audit azioni reparto + modalità kiosk (parzialmente fatto stasera) |
| Magazzino | ~78% | Giacenza valorizzata (fatto stasera), inventari |
| Sicurezza DB | Avanzato | HIBP appena c'è piano Pro+ |
| API pubbliche | ~42% | OAuth client_credentials (fatto stasera, in test) |
| Fiscale IT (RT/SDI) | Parziale | Solo stub — serve vendor + commercialista |

---

## 02 — Lente marketing/business: cosa manca per vendere sul serio

Qui il gap non è tecnico: due pezzi del motore commerciale non esistono ancora davvero, e un dettaglio di comunicazione è incoerente.

- **Listino prezzi non persistito su server**: i piani mostrati in Landing (Base 69€, Pro 115€, Enterprise 153€, Full 428€/mese) vengono letti da `localStorage`, popolati da un default se vuoto. Il testo in pagina lo ammette: *"variano in base alla configurazione salvata in console (stesso browser)"*. Un cambio prezzo fatto su un PC non si propaga ad altri browser.
- **Nessuna fatturazione SaaS reale verso le pizzerie clienti**: l'"addebito automatico" in Super Admin → Clienti è solo una spunta manuale — il testo accanto dice testualmente *"gateway di pagamento da configurare"*. Distinto dallo Stripe che le pizzerie usano per farsi pagare dai propri clienti (flusso diverso, anch'esso non live).
- **Prova gratuita: 7 o 14 giorni?** Landing e guida Super Admin dicono 14 giorni; il commento in `usePlan.js` dice "prova 7 gg". Da allineare prima di comunicazioni ufficiali.
- **Attivazione cliente solo manuale**: nessun self-service — la Landing dice che la prova "si attiva contattando l'admin". Scelta valida in fase early, ma ogni nuovo cliente passa da un intervento manuale.

---

## 03 — Lente IT/infrastruttura: cosa manca per dormire tranquilli

- **Nessuna strategia di backup indipendente**: il backup del DB dipende solo dal piano Supabase attivo — nessun backup scriptato/documentato lato PizzaManager. `PROGRAMMA_AFFIDABILITA.md` lo segna come "in corso", non fatto.
- **6 edge function pubbliche senza verifica JWT, da rivedere una a una**: solo `payment-stripe-webhook` ha giustificazione solida (firma Stripe verificata nel codice). `payment-sumup-confirm`, `payment-sumup-create-checkout`, `notifiche-outbox-processor`, `oauth-token`, `api-v1-ordini` sono richiamabili senza sessione utente — vanno confermate una per una (secret, firma, bearer OAuth verificati internamente).
- **RLS sulle 9 tabelle backup: da riverificare a mano**. Le tabelle `*_backup`/`_prisma_migrations` con RLS disattivata trovate stasera **non compaiono più** nell'ultima scansione advisor, ma non sono state corrette (restava in sospeso conferma esplicita del titolare) — potrebbe essere cache dell'advisor, non correzione reale. **Verificare in Dashboard → Database → Tables prima di considerarlo chiuso.**
- **Notifiche cliente**: solo la stampa in cucina/sala è un canale realmente operativo oggi. Email/SMS/WhatsApp/RT-SDI hanno il codice pronto (pattern adapter) ma mancano le credenziali dei fornitori.

### Test automatici

| Tipo | Copertura | Quando gira |
|------|-----------|-------------|
| Unit (Vitest + Node) | 28 file | Ad ogni push su main (CI) |
| E2E Playwright | 2 file, smoke minimo | Ogni lunedì 07:00 UTC + manuale |
| Security smoke | 4 check RLS/whitelist/Stripe | Ogni lunedì 06:00 UTC |

---

## Cosa manca da te: 9 decisioni/credenziali

Nessuna richiede altro sviluppo — solo una scelta, un account o una chiave.

1. **Chiavi Stripe live (Francy)** — blocca i pagamenti online reali.
2. **Dominio reale + DNS per il menu Francy** — runbook già scritto, serve solo il record DNS + custom domain Firebase.
3. **Conferma su RLS delle 9 tabelle backup** — chiuderle ora o lasciarle? Vedi nota IT sopra.
4. **Upgrade Supabase a piano Pro+** — unico modo per attivare HIBP (protezione password compromesse).
5. **Vendor Registratore Telematico/SDI + commercialista** — codice pronto (outbox+worker), manca chi lo fornisce.
6. **Credenziali SMTP/SMS/WhatsApp** — adapter scritti, servono le chiavi del fornitore scelto.
7. **Decisione canale notifiche cliente** — restare solo su stampa in sala, o attivare email/SMS/WhatsApp quando arrivano le credenziali?
8. **POS certificati (PAX/Ingenico)** — solo se il locale lo richiede, serve hardware/SDK di test.
9. **Dati legali reali nel `.env`** — nome titolare, indirizzo, email privacy sono ancora valori d'esempio (Mario Rossi) nelle pagine pubbliche privacy/cookie.

---

## Prossimo passo consigliato (in ordine)

1. **Commit + push di tutto il lavoro accumulato** — prima di qualunque altra cosa, per non dipendere da questa macchina per il codice già live in produzione.
2. **Verifica manuale RLS sulle 9 tabelle backup** — 5 minuti in Dashboard per chiudere davvero il rischio, non solo sull'advisor.
3. **Stripe live + smoke pagamento Francy** — segue `docs/GO_LIVE_FRANCY_RUNBOOK.md`, già scritto passo passo.
4. **DNS + dominio menu Francy** — in parallelo al punto 3.
5. **Backtest con la checklist aggiornata** — vedi `docs/QA_CHECKLIST_SMOKE.md`, sezione "Novità sessione 20–21/08".

---

## Correlati

- Report visuale (Artifact): pubblicato in sessione, stessa sintesi in formato dashboard.
- `docs/GO_LIVE_FRANCY_RUNBOOK.md`, `docs/QA_CHECKLIST_SMOKE.md`, `docs/BACKLOG_E_STATO_SVILUPPO.md`, `docs/MACROFASI_SVILUPPO.md`
- [11 — Priorità operative](./11_priorita_operative.md), [10 — Supervisore](./10_supervisor.md)
