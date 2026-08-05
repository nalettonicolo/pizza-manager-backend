# Punto situazione — Prodotto / operazioni

**Data:** 2026-08-04  
**Ruolo:** Product / dominio pizzeria (flussi reali, non implementazione)  
**Contesto macro:** Macrofasi 1–5 completate (core); **Fase 6 — Produzione hard** in corso.  
**Fonti:** `docs/BACKLOG_E_STATO_SVILUPPO.md`, `docs/MACROFASI_SVILUPPO.md`, `docs/GO_LIVE_ORDINI_WEB.md`, guide Admin/Super Admin, roadmap servizi.

---

## 1. Visione SaaS

PizzaManager è una **piattaforma multi-tenant** per pizzerie: ogni locale (tenant) ha i propri menu, ordini, staff, parametri e — se pubblicata — una **vetrina ordini** sul proprio dominio.

### Attori e confini

| Attore | Cosa fa nella realtà | Cosa deve fare il prodotto |
|--------|----------------------|----------------------------|
| **Cliente finale** | Ordina da casa / ritira / riceve a domicilio; guarda storico e punti | Vetrina + area account senza confusione con lo staff |
| **Staff operativo** | Cassa, forno, bancone, pony | Schermate tablet/reparto chiare, stati ordine condivisi, picchi gestibili |
| **Titolare / admin locale** | Menu, orari, persone, magazzino “da gestore” | Console tenant isolata; niente go-live DNS (quello è piattaforma) |
| **Super Admin piattaforma** | Onboarding clienti, piani, domini, supporto live | Console SaaS + Demo live / Sala QA su dati reali del tenant |

### Promessa operativa (cosa “chiude” una serata)

1. L’ordine nasce da **un canale** (banco, telefono→cassa, web).  
2. Entra in **cucina / pizzaiolo / bancone** con totali e note affidabili.  
3. Esce come **asporto, sala/negozio o delivery** con pagamento e (dove previsto) prova di consegna.  
4. Il titolare vede **incassi e report** senza mischiare tenant.

### Dove siamo nella roadmap

- **Fatto (macro 1–5):** piattaforma live, cliente end-to-end, back-office, delivery/rider, enterprise core (catalogo SA, offline cassa base, stub fiscali/OAuth).  
- **In corso (macro 6):** produzione “hard” sul primo cliente reale (**Francy**): Stripe live, dominio menu, adapter notifiche/fiscale quando ci sono credenziali.

---

## 2. Flussi canale: cassa, negozio, delivery, web

### 2.1 Cassa (banco / telefono / asporto al bancone)

**Attori:** cassiere (± turno obbligatorio se parametro attivo).

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 1 | Apre / conferma turno cassa (se richiesto) | Ordini collegabili al turno |
| 2 | Sceglie punto vendita (se multi-PV) | Listino e poligoni coerenti col PV |
| 3 | Compone ordine (pizze, formati, extra, bibite…) | Righe e totali univoci |
| 4 | Tipo: negozio / asporto / delivery | Percorso reparti e consegna corretto |
| 5 | (Opzionale) Fedeltà su negozio: cerca cliente, premio punti | Punti scalati alla conferma se premio attivo |
| 6 | Pagamento (anche misto) + conferma | Ordine in preparazione; comanda verso reparti |
| 7 | Annulli / modifiche | Motivazione e coerenza totali; niente “fantasma” in cucina |

**Regole business tipiche**

- Se **turno obbligatorio** e turno chiuso → **blocca** nuovi checkout cassa.  
- Se prodotto **esaurito** → non vendibile (o avviso forte) fino a ripristino.  
- Pagamento misto: somma quote = totale; sconti devono restare auditabili.

**Eccezioni**

- Cliente cambia ordine **dopo** invio in cucina → modifica controllata o annullo + nuovo; cucina deve vedere lo stato aggiornato (Realtime / refresh).  
- Rete assente → coda offline (enterprise): sync idempotente al rientro; **non** inventare documenti fiscali offline senza regole RT.

### 2.2 Negozio / consumo in locale

Flusso cassa con tipo **negozio**: priorità bancone (bevande/fritti) + pizzaiolo; fedeltà tipicamente sul banco. Nessun rider. Chiusura serata = riconciliazione turno + strip incassi.

### 2.3 Delivery (sala comando + rider)

| Passo | Attore | Azione | Esito |
|-------|--------|--------|-------|
| 1 | Cassa o web | Ordine delivery con indirizzo in area | Accettato solo se poligono/PV ok |
| 2 | Cucina / pizzaiolo | Preparazione | Stati verso “pronto” |
| 3 | Desk delivery | Assegna / ordina uscite (nearest-neighbor GPS) | Rider vede coda PWA |
| 4 | Rider | Parte, consegna, **prova** (firma/foto) | Stato consegnato + prova Storage |
| 5 | Desk | Monitora mappa live | Ritardi visibili in sala |

**Regole**

- Fuori area → **blocca** o messaggio chiaro in checkout.  
- Rider assente → riassegnazione desk; non chiudere “consegnato” senza prova se il flusso lo richiede.  
- Proof: senza firma/foto dove obbligatoria → non chiudere consegna.

**Gap prodotto ancora aperti (enterprise):** VRP ricco, SLA cliente, notifiche SMS/WA al cliente, integrazioni Glovo/Uber.

### 2.4 Web (vetrina / menu online)

| Passo | Attore | Azione | Esito |
|-------|--------|--------|-------|
| 1 | Cliente | Naviga menu, carrello, fascia oraria | Slot forno: fasce piene nascoste/bloccate |
| 2 | Cliente | Checkout (ritiro o delivery) | Antifraud: max 8 ordini web/ora/cliente; blocklist staff |
| 3 | Sistema | Se Stripe: ordine **IN_ATTESA** | Non cucina “vera” fino a pagamento |
| 4 | Stripe webhook | Conferma pagamento | **IN_PREPARAZIONE** |
| 5 | Sala | **Stampa comanda automatica** (parametro) | Percorso primario senza email/SMS |
| 6 | Cliente | Area account: storico, profilo, fidelity | Continuità post-ordine |

**Regole**

- Slot pieno (`pizze_ogni_15_min`) → checkout rifiuta (`slot_forno_pieno`).  
- Pagamento non confermato → resta in attesa; non saturare il forno.  
- Con stampa comanda web ON, le notifiche email/push **non** sono il percorso primario di sala.

**Eccezioni**

- Cliente abbandona Stripe → ordine in attesa da gestire (timeout / annullo operativo).  
- Dominio menu non configurato → vetrina su host SaaS/test; esperienza marca debole (gap go-live).

---

## 3. Cucina, bancone, pizzaiolo

Tre schermate **stesso ordine**, ruoli diversi (come in sala reale).

| Reparto | Job to be done | Cosa deve vedere |
|---------|----------------|------------------|
| **Pizzaiolo** | Impasto, farcitura, forno | Solo pizze / note cottura; priorità temporale |
| **Cucina** | Fritti, piatti non-pizza, coordinamento | Code miste; stati avanzamento |
| **Bancone** | Bevande, dolci, allestimento ritiro | Pronto per consegna al cliente / al pony |

**Flusso tipico serata**

1. Ordine entra (cassa o web stampato / Realtime).  
2. Pizzaiolo e cucina lavorano in parallelo.  
3. Bancone aggrega “completo” per ritiro o passa a delivery.  
4. Cambio stato visibile a tutti i tablet (Realtime su ordini + fallback polling).

**Regole**

- Chi non ha permesso area → non entra (o solo lettura se previsto).  
- Ingredienti esauriti mid-service → “Prodotti esauriti” / blocco vendita; cucina non deve inventare sostituzioni silenziose.  
- Picco: capacity forno sul **web** protegge il forno; in cassa resta disciplina umana (parametri + formazione).

**Gap prodotto**

- Audit fine “chi ha cambiato stato e quando”.  
- Modalità kiosk (logout automatico, sessione corta).  
- Matrice permessi per **azione**, non solo per area.

---

## 4. Area cliente (end-to-end)

Macrofase 2 **completata** a livello prodotto core.

| Capacità | Stato prodotto | Note operative |
|----------|----------------|----------------|
| Menu / carrello / checkout | Operativo | Capacity + antifraud |
| Account, storico ordini | Operativo | Post-checkout |
| Profilo / geo indirizzo | Operativo | Delivery |
| Programma fidelity (UI) | Operativo | Allineare regole premio con cassa |
| Password dimenticata sul dominio vetrina | Operativo **se** Auth redirects configurati | Dipende da go-live dominio |
| Pagamento carta live | **Bloccato da Stripe live** | Oggi tipicamente test keys |

**Attore → esito:** cliente completa ordine → vede conferma/storico → (delivery) riceve → (fidelity) accumula/riscatta secondo regole tenant.

**Gap:** SEO/PWA cliente, CAPTCHA oltre velocity, rimborsi Stripe live, messaggi proattivi (SMS/WA) sullo stato ordine.

---

## 5. Admin tenant (gestore locale)

**Perimetro:** un solo tenant. Non gestisce DNS/Firebase pubblici (Super Admin).

| Area | Uso reale | Maturità percepita |
|------|-----------|--------------------|
| **Menu / listino** | Categorie, pizze, ingredienti, bibite, allergeni, promo | Forte — cuore quotidiano |
| **Impostazioni** | Dati pizzeria, layout, orari, parametri (cassa, forno, stampa web, notifiche stub) | Forte |
| **Dipendenti / Ruoli** | Chi entra in cassa/cucina/… | Adeguato; RBAC fine ancora gap |
| **Report** | Vendite periodo, top prodotti | Base (non lista live) |
| **Magazzino** | Fornitori, DDT, movimenti (hub DB) | WIP ~78% — manca valorizzazione/inventari ciclici |
| **Contabilità locale** | Fatture, spese, food cost, incassi | Presente; non sostituisce commercialista/SDI |
| **Manuale in-app** | Formazione titolare/staff | Presente |

**Regola prodotto:** se piano/servizi non include un modulo e enforcement attivo → voce nascosta/bloccata; il gestore contatta la piattaforma.

**Gap admin tipici**

- Lista ordini “gestionali” dedicata in admin (oggi: operativo + report).  
- KPI executive dedicati.  
- Alert magazzino automatici unificati.  
- Versioning listino / happy hour per canale.

---

## 6. Super Admin — Demo live e Sala QA

### Demo live

- Stesso account Super Admin, **dati reali del tenant** scelto.  
- Giro guidato reparti: Cassa → Pizzaioli → Cucina → Bancone → Delivery/Pony.  
- Navigazione sidebar + “4 schermate”; marker `_demo_giro` + override tenant supporto.  
- **Scopo commerciale/supporto:** mostrare il locale come lavora in sala, non un sandbox vuoto.

### Sala QA / supporto live

- Console multi-finestra (`/superadmin/sala-qa`): iframe/reparti sul tenant in supporto.  
- Presence legata all’utente autenticato (no cross-tenant spurio).  
- Gate privacy SA in produzione.  
- Utile per: assist remota serata, verifica Realtime, formazione.

**Regola:** Super Admin in Demo/Sala **non** è staff del locale; ogni azione sensibile va trattata come supporto privilegiato (audit da rafforzare).

---

## 7. Cosa funziona in produzione — tenant Francy

Stato al **2026-08-04** (allineato backlog/macrofase del 2026-08-03):

| Capacità | Francy | Impatto operativo |
|----------|--------|-------------------|
| Hosting app / deploy | OK | Staff e vetrina raggiungibili su infrastruttura attuale |
| Ordini cassa + turni + PV | OK | Flusso serata banco |
| Cucina / bancone / pizzaiolo + Realtime | OK | Tablet aggiornati |
| Delivery desk + rider PWA + mappa + proof | OK | Consegne tracciate |
| Stampa comanda **web automatica** | **ON** | Percorso primario ordini online in sala |
| Capacity forno + antifraud web | OK | Protezione picchi / abuso |
| Magazzino hub DB | OK (core) | Fornitori/DDT su Supabase |
| Guide DNS + CTA sito | OK in prod | Onboarding dominio |
| SA gate privacy + Sala QA | OK in prod | Supporto |
| **Stripe** | Solo chiavi **test** | Pagamenti web non “soldi veri” |
| **Dominio menu reale** | Non chiuso | Brand/URL cliente incompleti |
| SMTP Auth cliente / RT-SDI | Stub / non live | Niente email Auth prod-grade né corrispettivi da app |

**Sintesi Francy:** la pizzeria può **operare sala e delivery** e ricevere ordini web con comanda stampata; il canale carta **live** e il **dominio proprio** sono i due blocchi prodotto-go-live ancora aperti.

---

## 8. Gap prodotto (requisiti, non ticket tecnici)

### 8.1 Critici per “pronto cliente pagante online”

1. **Pagamenti Stripe live** (chiavi + webhook + smoke serata).  
2. **Dominio vetrina** (DNS + hosting custom + redirect Auth reset password).  
3. Messaggistica cliente (SMTP/SMS/WA) **oppure** accettare esplicitamente “solo stampa in sala + area account”.

### 8.2 Critici per compliance Italia (medio termine)

4. **Registratore telematico / SDI**: oggi adapter stub; serve vendor + commercialista. L’app resta gestionale finché il RT non è nel circuito.  
5. POS certificati (PAX/Ingenico) se il locale non vuole doppio passaggio manuale.

### 8.3 Operatività avanzata

6. Audit azioni reparto; kiosk mode.  
7. Magazzino: giacenza valorizzata, inventari, alert scadenze.  
8. Report executive, export schedulati, multi-PV consolidato.  
9. Notifiche multicanale reali; push staff.  
10. Aggregator delivery esterni.  
11. API pubbliche OAuth per partner.  
12. Billing abbonamenti tenant Stripe (SaaS commerciale).  
13. HIBP / leaked passwords (piano Supabase Pro+).  
14. SLA supporto / account manager (organizzazione, non prodotto software).

### 8.4 Cassa enterprise (visione lunga)

Da `ROADMAP_CASSA_ENTERPRISE`: split/audit illimitati, offline DR completo, omnicanalità kiosk/QR senza divergenza totali — **dopo** stabilità cassa online e scelta RT.

---

## 9. Dipendenze esterne (bloccanti non-repo)

| Dipendenza | A cosa serve in pizzeria | Stato tipico oggi |
|------------|--------------------------|-------------------|
| **Stripe live** (`pk_live` / `sk_live` / `whsec`) | Carte sul menu online | Francy: solo test |
| **Dominio + DNS + Firebase custom domain** | URL marca (es. menu della pizzeria) | Guide OK; cutover Francy aperto |
| **Redirect Auth Supabase** per host cliente | Reset password sul sito locale | Da aggiungere per ogni hostname |
| **SMTP `no-reply@…`** | Registrazione/conferma/reset email clienti | Dashboard; non sandbox |
| **Vendor RT + commercialista** | Corrispettivi / chiusure fiscali | Stub adapter; nessuna emissione da app |
| **Hardware POS certificato** | Bancomat allineato a fiscale | Non in circuito prodotto |
| **Credenziali SMS / WhatsApp Business** | Avvisi stato ordine / desk | Stub |
| **Supabase Pro+** (opzionale) | HIBP leaked passwords | Free non abilita toggle |

Finché queste non arrivano, il backlog software **non** può “chiudere” da solo le percentuali enterprise su pagamenti, fiscale e notifiche.

---

## 10. Ordine di priorità prodotto (ora)

Allineato a Fase 6 e backlog engineering, **dal punto di vista del locale**:

| # | Priorità prodotto | Perché in sala |
|---|-------------------|----------------|
| **1** | **Stripe live su Francy** + smoke pagamento web | Senza soldi veri il canale online resta demo |
| **2** | **Dominio menu Francy** (DNS + Firebase + Auth redirects) | Fiducia cliente e link da social/Google |
| **3** | Decidere canale notifiche: restare su **stampa comanda** oppure attivare **SMTP/SMS/WA** con credenziali | Aspettative “mi arriva il messaggio” |
| **4** | Percorso **RT/SDI** (scelta vendor + questionario fiscale) | Obblighi esercente; non confondere con gestionale |
| **5** | Rafforzare **operativo tablet** (audit, kiosk) e **magazzino valorizzato** | Qualità serata e costi |
| **6** | Report / multi-sede / API / billing SaaS | Crescita piattaforma e catene |

**Non prioritizzare ora** (rispetto al go-live Francy): aggregator Glovo, SSO SAML, BI Snowflake, penetrations periodiche come *feature* — utili dopo che carta + dominio sono live.

---

## 11. Riferimento macrofasi e backlog (sintesi)

| Macrofase | Nome | Stato |
|-----------|------|-------|
| 1 | Go-live piattaforma | Completata |
| 2 | Cliente end-to-end | Completata |
| 3 | Back-office persistente | Completata |
| 4 | Operativo & consegne | Completata (core) |
| 5 | Piattaforma enterprise | Completata (core) |
| 6 | Produzione hard | **In corso** — Stripe live e dominio Francy aperti |

Backlog epic (ordine di grandezza): ordini online ~84%, consegne ~84%, tablet/Realtime ~72%, magazzino ~78%, fiscale IT parziale, API pubbliche ~42%.

---

## 12. Criteri di “chiusura” prodotto (DoD serata)

Un tenant si considera **operativamente online sul canale web** quando:

1. Cliente paga con carta **live** e l’ordine passa in preparazione.  
2. In sala arriva **comanda stampata** (o canale notifica equivalente accettato dal titolare).  
3. Cucina/bancone/pizzaiolo vedono l’ordine senza intervento Super Admin.  
4. Delivery (se attivo) chiude con prova.  
5. Dominio vetrina è quello comunicato ai clienti (non solo URL piattaforma).  
6. Isolamento tenant verificato (nessun dato altro locale).

Al **2026-08-04**, Francy soddisfa in larga parte i punti 2–4 e 6; **mancano 1 e 5** (e il fiscale certificato resta fuori perimetro finché non c’è RT).

---

*Documento prodotto — solo flussi, regole e priorità. Nessuna specifica di implementazione.*  
*Prossima revisione consigliata: subito dopo smoke Stripe live e cutover dominio Francy.*
