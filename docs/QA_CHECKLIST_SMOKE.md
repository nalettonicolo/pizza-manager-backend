# Checklist smoke / regressione (PizzaManager)

Usala dopo deploy o prima di una release. Per ogni voce: **OK** / **KO** e breve nota (browser, tenant di test, errore console).

**Come usarla:** account tenant admin reale o di staging; stesso dominio del deploy (es. `pizzamanager.it`). Dove serve il piano, usa un tenant con/senza servizio indicato.

_Ultimo aggiornamento contenuti: 2026-08-21 (aggiunta sezione novità sessione rider/OAuth/tavoli/colori prep)._

---

## Novità sessione 20–21/08 (rider, OAuth, tavoli, colori preparazione)

Sezione aggiuntiva per le feature/fix costruiti in questa sessione, non ancora passati da un backtest reale. Da eseguire **prima** delle sezioni sopra, non in sostituzione.

### Rider — posizione e auto-assegnazione

Precondizioni: tenant con almeno un rider (`core.rider`, campo `auth_user_id` collegato a un account che può loggarsi), turno rider aperto su un punto vendita.

- [ ] Login come rider (o account con `auth_user_id` associato) → aprire **Delivery Dashboard**: la posizione GPS locale continua a funzionare come prima (ordinamento nearest-neighbor).
- [ ] Con turno rider aperto: dopo qualche minuto verificare in DB (`core.rider_posizione`) che la riga del rider si sia aggiornata (RPC `rider_upsert_posizione`, sync ogni ~60s).
- [ ] Login come **staff non-rider** (es. admin/cassa) su Delivery Dashboard: nessun errore in console per la sync posizione (deve fallire in silenzio, "rider non trovato").
- [ ] Bottone **"Assegna auto"** su un ordine delivery con coordinate di consegna valide: assegna un rider con turno aperto e nessuna consegna già in corso; verificare `stato_delivery` → `ASSEGNATO` e riga in `core.ordine_consegna_evento`.
- [ ] Stesso bottone su ordine **senza** rider disponibile (nessun turno aperto): messaggio di errore leggibile, nessun crash.
- [ ] Se `ORS_API_KEY` non è impostata: l'assegnazione funziona comunque (fallback Haversine via `assegna_ordine_rider_auto`), nessun errore bloccante.

### API partner OAuth (`oauth-token`, `api-v1-ordini`)

Precondizioni: un client OAuth creato via `superadmin_create_oauth_client` (nessuna UI ancora — da SQL/console Supabase).

- [ ] `POST /functions/v1/oauth-token` con `client_id`/`client_secret` validi → risponde `access_token` + `expires_in`; con credenziali sbagliate → `401 invalid_client` (non 500).
- [ ] `GET /functions/v1/api-v1-ordini` con token valido e scope `read:ordini` → lista ordini del tenant corretto; con token scaduto o scope mancante → errore esplicito, non elenco vuoto silenzioso.

### Gestione tavoli (backend pronto, nessuna UI ancora collegata)

- [ ] `tavoliService.js` (`getTavoli`, `apriContoTavolo`, `aggiungiGiroTavolo`, `chiudiContoTavolo`, ecc.) — se già richiamato da qualche pagina, verificare che apra/chiuda un conto senza errori RPC. **Se nessuna pagina lo usa ancora, segnare N/A** e non considerarlo testato.

### Kiosk auto-logout

Precondizioni: `parametri_operativi.kiosk_logout_minuti` impostato a un numero > 0 su un tenant di test (**non collegato di default** — se il parametro non è impostato, questa voce non si applica).

- [ ] Con `kiosk_logout_minuti` impostato: nessuna interazione (click/tap/tasto) per il tempo configurato → logout automatico e redirect a `/login`.
- [ ] Toccando/cliccando/digitando prima della scadenza: il timer si resetta, nessun logout prematuro.
- [ ] Con il parametro **non impostato** (o 0): nessun logout automatico — comportamento invariato rispetto a prima.

### Cucina / Bancone / Pizzaiolo — colori preparazione e routing

Precondizioni: tenant con almeno un prodotto flaggato "Prep. cucina" con categoria impostata (es. una bibita), e ingredienti con categoria (congelato/affettato/dolce/fritto).

- [ ] **Colori coerenti**: uno stesso ingrediente/prodotto con la stessa categoria mostra **lo stesso colore** sia in Cucina che in Bancone (prima erano due mappe colore diverse).
- [ ] **Con reparto Cucina attivo** (`cucina_tablet_abilitato`): il pannello ingredienti (non bibite) **sparisce da Bancone** — resta solo la sezione Bibite; Cucina mostra tutto il resto.
- [ ] **Senza reparto Cucina**: Bancone torna a mostrare sia ingredienti sia bibite, come prima.
- [ ] **Pizzaiolo**: compare il nuovo pannello "Ingredienti fuori linea" quando ci sono task pendenti; cliccando un chip risulta "pronto" **anche** in Cucina/Bancone (stesso stato condiviso, non 3 checklist separate).
- [ ] **Colore prodotto** (Admin → Menù → categoria con "Prep. cucina", es. Bibite/Dolci/Fritti): impostando una categoria colore sul prodotto, il task "prodotto intero" in Cucina/Bancone/Pizzaiolo prende quel colore invece del grigio "comune".

### CSV ingredienti — colore rimosso

- [ ] **Import**: un CSV con colonna `categoria` (senza `colore`) crea un nuovo ingrediente con il colore di default della categoria assegnato in automatico.
- [ ] **Import su ingrediente esistente**: il colore attuale (custom o di default) **non viene toccato** dal CSV, anche cambiando categoria.
- [ ] **Export**: il file scaricato non contiene più la colonna `colore`.
- [ ] Import di un file grande (30+ righe): tempo di caricamento sensibilmente più rapido rispetto a prima (elaborazione a lotti in parallelo, non più una riga alla volta).

### Cassa / Pony — aggiornamento in tempo reale

- [ ] **Cassa**: un cambio ordine fatto da un altro reparto (es. Cucina segna pronto) si riflette in Cassa senza dover aspettare ~40s (Realtime attivo, non solo polling).
- [ ] **Pony**: stesso comportamento; nessuna regressione sul flusso "segna consegnato".
- [ ] Colonna carrello in Cassa: pulsanti **"Svuota"** e **"Conferma Ordine"** in cima alla lista prodotti (non più in fondo).

### Bug corretti da verificare

- [ ] **Turni cassa → "Apri turno"**: non deve più dare l'errore `column pv.deleted_at does not exist` — il turno si apre correttamente.
- [ ] **Logo** in header/footer vetrina pubblica: nitido, nessuna differenza visibile rispetto a prima (solo più leggero da caricare).

---

## Admin tenant (`/admin/*`)

### Navigazione e home

- [ ] **Nessuna voce «Riepilogo»** nella barra blu in alto: non deve comparire tra le voci admin.
- [ ] **Home admin:** aprendo `/admin` o `/admin/dashboard` il browser finisce su **`/admin/menu/categorie`** (o almeno sotto `/admin/menu/…`); nessuna schermata KPI «ordini oggi / fatturato / utenti» dedicata.
- [ ] **Logo / nome locale** in alto a sinistra: click porta alla stessa home menu (`/admin/menu` → categorie), non a una pagina 404 o vuota.
- [ ] **`/admin/pubblicazione`:** redirect a **`/admin/manuale`** (nessun form tenant; nessuna sidebar menu).
- [ ] **Barra superiore — voci attese:** **Manuale**, **Menu**, **Dipendenti**, **Impostazioni** sempre (se loggato come admin tenant). **Report** e **Ruoli** solo se il tenant ha i servizi `report_analisi` e `ruoli_avanzati` (o con gate disattivato). **Non** deve esserci **Pubblicazione** nella barra tenant.
- [ ] **Magazzino** e **Costi** in barra come **etichette non cliccabili** (roadmap), dopo i link reali; tooltip «in roadmap».
- [ ] **Barra superiore — azione:** ogni voce visibile apre la URL corretta (`/admin/manuale`, `/admin/report`, `/admin/menu/…`, `/admin/dipendenti`, `/admin/ruoli`, `/admin/settings/…`); **`/admin/guida`** reindirizza a **`/admin/manuale`**; evidenziazione «active» coerente con la pagina corrente.

### Sidebar laterale (blu)

- [ ] **Con URL** `/admin/menu/…` **oppure** `/admin/settings/…`: compare la colonna sinistra con titolo **«Menu e listino»** o **«Impostazioni»** e l’elenco delle sotto-voci (es. Categorie, Ingredienti… / Dati pizzeria, Layout…).
- [ ] **Con URL** `/admin/manuale`, `/admin/report`, `/admin/dipendenti`, `/admin/ruoli`: **nessuna** sidebar blu «Gestione» generica; solo barra in alto + contenuto principale (Manuale ha roadmap + mappa concettuale, vedi sotto).

### Barra utente

- [ ] **Email** dell’account loggato visibile in header (prima di «Admin» / «Esci»); se lunga, testo troncato con **ellipsis** e **title** al passaggio mouse con email completa.

### Manuale (`/admin/manuale`)

- [ ] **Roadmap sinistra** «Roadmap»: macro e micro allineati a `manualeRoadmap.js` (non le voci del menu in alto).
- [ ] **Mappa concettuale** sopra il testo: card per macro; click → stessa destinazione della roadmap (scroll morbido).
- [ ] **Click roadmap / mappa:** scroll morbido alla sezione; intestazioni **`##` / `###` / `####`** nel markdown hanno **anchor** coerenti (hash URL aggiornato se applicabile).
- [ ] **Contenuto:** `manualeUtente.md` reso senza errori evidenti (tabelle, link esterni in nuova scheda dove previsto).

### Report (`/admin/report`)

- [ ] **Caricamento:** con tenant valido la pagina esce dallo stato di caricamento e mostra totali (anche **0** se non ci sono ordini nel periodo); con tenant assente compare messaggio esplicito, non spinner infinito.
- [ ] **Nessuna** sidebar blu admin su questa pagina.

### Menu (`/admin/menu/…`)

- [ ] **Sidebar:** tutte le voci (Categorie, Formati, Cottura, Pizze, Ingredienti, Impasti, Bibite, Dolci, Fritti, Allergeni) sono cliccabili e caricano la pagina giusta.
- [ ] **Smoke salvataggio:** almeno una modifica su **Categorie** e una su **Ingredienti** (o altra pagina a scelta) salva senza errore in console e messaggio di feedback coerente.

### Impostazioni (`/admin/settings/…`)

- [ ] **Sotto-sezioni** Dati pizzeria, Layout, Giorni e orari, Parametri: navigazione da sidebar e da URL diretto funziona.
- [ ] **Smoke salvataggio:** un campo in **Dati pizzeria** o **Parametri** persiste dopo refresh o riapertura pagina.

### Dipendenti (`/admin/dipendenti`)

- [ ] **Tabella** con colonne riconoscibili: dipendente (nome + email), **ruolo base** con etichette **in italiano** nel select, colonna **accesso** (checkbox Abilitato + badge stato).
- [ ] **Ricerca:** filtra per sottostringa su nome o email; con nessun risultato compare messaggio esplicito.
- [ ] **Callout** «Perché due pagine?» presente; link a **Ruoli** funziona.
- [ ] **Modifica ruolo** e **toggle Abilitato:** dopo il salvataggio la tabella si aggiorna (o ricarica) senza alert bloccanti; in caso di errore backend, messaggio comprensibile.

### Ruoli (`/admin/ruoli`)

- [ ] **Intro** con link a **Dipendenti** funzionante.
- [ ] **Elenco utenti** con etichetta da email, toggle Abilitato, eventuale checkbox parametri cassa per ruolo cassa.
- [ ] **Modale dettaglio:** testo «cosa può fare» + **Aree consentite** con checkbox coerenti con ruolo (ruoli di reparto dedicati vs operatore).

### Gate servizi (solo se `VITE_ENFORCE_SERVIZI_PLAN=true` in build)

- [ ] Senza servizio **report:** apertura `/admin/report` reindirizza alla **home menu** (non errore bianco).
- [ ] Senza servizio **ruoli avanzati:** apertura `/admin/ruoli` reindirizza alla **home menu**.

---

## Super Admin (`/superadmin/*`)

### Clienti / Tenants

- [ ] **Lista clienti:** caricamento senza errori; **creazione** nuovo tenant o **modifica** esistente completa senza crash.
- [ ] **Colonna sconto** (se presente in tabella): mostra **solo %**, **solo −X €**, o **entrambi** in base a cosa è valorizzato in `parametri_operativi` (coerente con modale).

### Modale cliente — piano e sconti

- [ ] Campi **Sconto %** e **Sconto fisso €** editabili dove previsto; valori accettati e validazione (no NaN, limiti ragionevoli).
- [ ] **Stima netto mensile** (o equivalente in UI): coincide con **`(canone listino × (1 − %/100)) − € fissi`**, arrotondata come in UI, **minimo 0**.
- [ ] **Salva** → **riapri modale stesso cliente:** `sconto_importo_euro` (e %) persistiti (verifica rilettura o controllo DB).

### Pubblicazione dominio

- [ ] Pagina **Pubblicazione dominio** (`/superadmin/pubblicazione-sito`): **nessuna** colonna sinistra aggiuntiva sotto la barra di navigazione; solo contenuto principale.
- [ ] Selezione tenant, campi dominio/stato, **salvataggio** senza errore; messaggio di successo/errore chiaro.

### Supabase Auth (go-live dominio vetrina)

- [ ] Per **ogni dominio** su cui è online il sito/menu cliente: in **Supabase Dashboard → Authentication → URL configuration → Redirect URLs** risulta presente **`https://<dominio>/reimposta-password`** (stesso host che usa il cliente in browser; eventuale wildcard se applicabile, es. `https://*.dominio.it/reimposta-password`).
- [ ] **Site URL** coerente con la piattaforma (es. `https://pizzamanager.it`); verificare che i link email di reset non vengano rifiutati per URL non in elenco (vedi **`docs/GUIDA_SUPERADMIN.md` §4.7c**).

### Login / accesso Super Admin

- [ ] Login superadmin → area prevista (es. ingresso o dashboard); logout riporta a flusso pubblico atteso.

### Demo live (Super Admin → clienti)

Precondizioni: account **Super Admin**; tenant demo attivo (es. Francy / `VITE_PUBLIC_DEMO_TENANT_ID`); mod. **39** + **40** applicati su Supabase.

- [ ] Gate `/superadmin/ingresso` → card **Demo live** avvia senza errore.
- [ ] URL operativo contiene `support_tenant`, `_demo_giro=1`, `_qa_console=1`.
- [ ] Sidebar operativa: Cassa, Pizzaioli, Cucina, Bancone, Delivery raggiungibili; query demo preservate.
- [ ] Link **4 schermate** / quad reparti senza crash.
- [ ] **Cassa — delivery:** nome cliente e indirizzo su righe distinte (ordini nuovi e legacy `Nome – Via…`).
- [ ] **Cucina:** coda visibile solo con task; empty state brevi.
- [ ] **Esci demo:** ritorno SA / clear override; staff non-SA non impersona via `support_tenant`.
- [ ] **Solo vetrina** (gate): anteprima menu/branding via RPC pubblica.
- [ ] Unit correlati verdi: `tests/unit/demoGiro.test.js`, `tests/unit/cassaDeliveryNomeIndirizzo.test.js`.

### Piani, CSV e abbonamenti

- [ ] **Piani:** import CSV (stesso formato dell’export) aggiorna/aggiunge piani per `id`; piani non presenti nel file restano in elenco; `validita_mesi` e sconto annuale coerenti dopo import.
- [ ] **Abbonamenti:** colonna ciclo **mensile/annuale** e **prossimo rinnovo** coerenti con data attivazione cliente (mesi di calendario, non 30/365 giorni fissi) dopo migrazione SQL colonne subscription.
- [ ] **Clienti (superadmin):** sezione archivio password staff — salvataggio nota e verifica in Admin tenant → Ruoli (dopo SQL `staff_password_note` + vista `ruoli_pizzeria`).

---

## Pubblico SaaS

### Contatti (`/contatti`)

- [ ] **Piano non «Personalizzato»:** i moduli **già inclusi** nel piano selezionato hanno checkbox **spuntate e disabilitate** (non si possono togliere); gli altri moduli restano selezionabili.
- [ ] **Piano «Personalizzato»:** **tutte** le checkbox moduli sono **abilitate** (nessuna disabilitata solo perché «già nel piano»).
- [ ] **Invio:** mailto o azione finale contiene **piano**, **moduli** e campi obbligatori compilati in modo leggibile.

### Landing / negozio (se in scope release)

- [ ] Home SaaS e link principali (login, contatti, negozio) rispondono 200 e non link rotti evidenti.

---

## Operativo e autenticazione

### Login / logout

- [ ] **Admin tenant:** dopo login si arriva a **`/admin/menu`** (flusso categorie), non a `/admin/dashboard` come pagina KPI.
- [ ] **Operatore** (o altro ruolo operativo): redirect alla home operativa prevista (es. dashboard operativo / cassa secondo ruolo).
- [ ] **Logout** da admin: sessione chiusa, accesso a `/admin/…` richiede di nuovo login.

### Selezione punto vendita (`/select-pv`)

- [ ] Con più PV: scelta e redirect coerente con ruolo; per **admin** dopo scelta si finisce su **`/admin/menu`** (non su vecchia dashboard).
- [ ] Messaggio «nessun PV» con link **Admin** punta a **`/admin/menu`** (o home menu).

### Area operativa

- [ ] Voci menu operativo visibili secondo **ruolo** e permessi.
- [ ] Se `VITE_ENFORCE_SERVIZI_PLAN=true`: voci legate a moduli non in piano **nascoste** o disabilitate come da implementazione.

---

## Smoke operativa multi-reparto (cassa → cucina → bancone → delivery)

Checklist aggiuntiva per regressioni su flussi multi-stato e più reparti. **Precondizioni:** tenant di test con dati base (categorie/prodotti/ingredienti); almeno 2 utenti (es. `cassa`, `delivery` o equivalente); planning e turni cassa attivi dove serve il caso.

### 1) Cassa — checkout / modifica / annullo

- [ ] Creare ordine **negozio** con almeno 2 righe prodotto.
- [ ] Verificare salvataggio `tipo_ordine`, totale e righe su DB.
- [ ] Modificare ordine (quantità, nota, tipo pagamento) e verificare persistenza.
- [ ] Cambiare ordine da `delivery` a `negozio` (o viceversa dove previsto) e verificare coerenza UI reparti.
- [ ] Annullare ordine e verificare esclusione da planning/contabilità ove applicabile.

### 2) Cucina — prep → pronto

- [ ] Aprire ordine in preparazione e segnare ingredienti prep.
- [ ] Portare ordine in **PRONTO**.
- [ ] Verificare presenza in Bancone e Delivery secondo regole (`tipo_ordine`, ecc.).

### 3) Bancone — pronto → consegnato

- [ ] Tappare alcuni chip ingredienti/bibite in Bancone.
- [ ] Refresh pagina e verificare persistenza pick.
- [ ] Cambiare set ordini (nuovo poll) e verificare pruning/messaggi reset dove previsti.
- [ ] Segnare ordine come **CONSEGNATO** e verificare rimozione dalla lista attesa.

### 4) Delivery — FSM consegna

- [ ] Impostare **ASSEGNATO**, poi **IN_VIAGGIO**; eseguire **CONSEGNATO**.
- [ ] Verificare transizione coerente (ordine + `stato_consegna`).
- [ ] Nessuna divergenza evidente tra `stato` e `stato_consegna`.

### 5) Planning slot e overnight

- [ ] Validare slot tipo `18:00–02:00`, `20:00–00:00`, `00:00–04:00` dove in uso.
- [ ] Verificare ordinamento slot e conteggi pizze per fascia.

### 6) Turni cassa

- [ ] Aprire turno cassa su punto vendita.
- [ ] Creare ordine con turno attivo.
- [ ] Chiudere turno e verificare riconciliazione base.

### 7) Sicurezza tenant (smoke)

- [ ] Utente tenant A non vede/modifica ordini tenant B.
- [ ] Creazione ordine via RPC solo su tenant autorizzato.
- [ ] Menu pubblico senza esposizione indebita di `tenant_id` nel payload client.

### Evidenze minime

- Screenshot per sezione; errori console/network; esito **PASS** / **FAIL** con note.

---

## Variabili d’ambiente / build (opzionale, ambiente di test)

- [ ] **`VITE_ENFORCE_SERVIZI_PLAN=true`:** verificare su un tenant **senza** un servizio che la voce admin/operativa collegata **non** compaia o sia inaccessibile come da spec.
- [ ] **`VITE_DISABLE_SERVIZI_GATE=true`:** stesso utente vede **Report** e **Ruoli** in barra anche se il tenant non avrebbe il servizio (comportamento bypass).

---

## Note finali

- In caso di **KO**, allegare: URL, ruolo utente, tenant ID (se utile), screenshot, estratto console (F12).
- *Aggiornare questo file a ogni implementazione rilevante:* **non rimuovere** voci già stabilite senza decisione esplicita; aggiungere righe nuove o dettagliare ulteriormente le esistenti.
