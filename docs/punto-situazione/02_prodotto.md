# Punto situazione — Prodotto / operazioni

**Data:** 2026-08-05  
**Ruolo:** Product / dominio pizzeria (flussi reali, **non** implementazione)  
**Profilo agente:** `agents/product.md`  
**Contesto macro:** Macrofasi 1–5 completate; **Fase 6 — Produzione hard** (Francy) in corso.  
**Fonti:** backlog, go-live Francy, comportamento live sala (cassa, reparti, stampa, turni).

---

## 0. Brief di questa revisione

Cosa è cambiato **per la sala** rispetto al 2026-08-04:

| Tema | Impatto prodotto |
|------|------------------|
| **Flusso stampa operativa** | Il gestore sceglie: solo cassa **oppure** tablet + ricevuta di cortesia da un reparto |
| **Home operativa** | Non più «Riepilogo» ambiguo → **Aree di lavoro** (scelta cassa/cucina/…) |
| **Turni** | Linguaggio gestore (niente database in UI) |
| **Permessi admin** | Admin/owner devono vedere tutte le aree operative (altrimenti home vuota) |

**Feature di prodotto in evidenza in questa revisione:** *Flusso stampa operativa (comanda + ricevuta di cortesia)*.

---

## 1. Visione SaaS (invariata, sintesi)

PizzaManager = piattaforma **multi-tenant**: ogni pizzeria ha menu, ordini, staff, parametri e (se pubblicata) vetrina sul proprio dominio.

| Attore | Job to be done |
|--------|----------------|
| Cliente | Ordinare, ritirare o ricevere; account e punti |
| Staff | Lavorare il proprio reparto senza confusione |
| Titolare | Configurare locale e persone; vedere incassi |
| Super Admin | Onboarding, supporto live, Demo / Sala QA |

**Promessa serata:** ordine → preparazione → ritiro/delivery → pagamento coerente → tenant isolato.

---

## 2. Feature in focus — Flusso stampa operativa

### 2.1 Contesto sala

Due modi reali di lavorare:

**A — Solo cassa (niente tablet in sala)**  
Stampante in cassa. Alla conferma ordine si decide *quando* e *quante copie* di comanda; opzionale ricevuta di cortesia (non fiscale) per il cliente.

**B — Con tablet nei reparti**  
I reparti lavorano da schermo. La **ricevuta di cortesia** (copia per pony / cliente) parte da un **reparto scelto** (tipico: Delivery), non automaticamente dalla cassa al checkout.

### 2.2 Flusso — modalità Solo cassa

| Passo | Attore | Azione | Esito |
|-------|--------|--------|-------|
| 1 | Gestore | Imposta in Cassa → Impostazioni: organizzazione = Solo cassa | Parametri sala salvati |
| 2 | Gestore | Imposta copie comanda (1–5) e *quando* stampare comanda | auto / manuale / mai |
| 3 | Gestore | Imposta *quando* stampare ricevuta di cortesia | auto / manuale / mai |
| 4 | Cassiere | Conferma ordine | Se auto → stampa subito; se manuale → banner con pulsanti; se mai → niente proposta |
| 5 | Cassiere | (Manuale) Preme Stampa comanda / Stampa ricevuta di cortesia | Carta in uscita |

### 2.3 Flusso — modalità Con tablet

| Passo | Attore | Azione | Esito |
|-------|--------|--------|-------|
| 1 | Gestore | Organizzazione = Con tablet; sceglie **reparto** che stampa la cortesia | Solo quel reparto vede il pulsante |
| 2 | Cassiere | Conferma ordine | Comanda secondo regole “quando” cassa; **non** auto-ricevuta da checkout |
| 3 | Staff del reparto scelto | Apre ordine / card → **Stampa ricevuta di cortesia** | Copia non fiscale per delivery/cliente |
| 4 | Pony / bancone | Usa la carta come cortesia | Cliente non riceve “scontrino fiscale” da questa stampa |

### 2.4 Regole (se / allora)

1. **Se** organizzazione = Solo cassa **allora** la ricevuta di cortesia si configura *quando* (auto/manuale/mai) in cassa.  
2. **Se** organizzazione = Con tablet **allora** la ricevuta di cortesia si stampa **solo** dal reparto configurato (o da nessuno se disattivata).  
3. **Se** “quando comanda” = mai **allora** dopo conferma non si propone comanda automatica né banner obbligatorio.  
4. **Se** prodotto esaurito **allora** non si vende (indipendente dalla stampa).  
5. La ricevuta di cortesia è **sempre non fiscale**: non sostituisce RT/SDI.

### 2.5 Eccezioni

| Situazione | Comportamento atteso in sala |
|------------|------------------------------|
| Stampante offline / driver | Messaggio chiaro; ordine resta salvato; si ristampa da dettaglio ordine |
| Reparto sbagliato configurato | Nessun pulsante dove serve → gestore corregge in Impostazioni |
| Tablet senza stampante collegata | Stampa dal browser del dispositivo che ha la stampante (o da cassa) |
| Ordine annullato dopo stampa | Ristampa/annuncio verbale; non inventare “storno fiscale” da cortesia |

### 2.6 DoD sala (questa feature)

- [ ] Gestore capisce le due organizzazioni senza spiegazioni tecniche.  
- [ ] In Solo cassa: copie + quando comanda + quando cortesia funzionano come impostato.  
- [ ] In Con tablet: solo il reparto scelto vede «Stampa ricevuta di cortesia».  
- [ ] Delivery tipico: pony ha la carta di cortesia al momento giusto.  
- [ ] Nessun testo UI che parla di database o tabelle.

---

## 3. Flussi canale (stato prodotto)

### 3.1 Cassa (banco / telefono / asporto)

| Passo | Azione | Esito |
|-------|--------|-------|
| 1 | Turno (se obbligatorio) | Checkout possibile |
| 2 | PV (se multi) | Listino/area coerenti |
| 3 | Composizione + tipo servizio | Righe/totali univoci |
| 4 | Fedeltà (negozio, se attiva) | Premio scalato in conferma |
| 5 | Pagamento (anche misto) + conferma | Preparazione + stampa secondo §2 |
| 6 | Modifica / annullo | Cucina allineata; niente fantasmi |

**Regole:** turno obbligatorio chiuso → blocca; esaurito → non vendibile; misto → somma quote = totale.

**Eccezioni:** modifica post-comanda → controllo o annullo+nuovo; offline → coda sync (enterprise), senza inventare fiscale.

### 3.2 Negozio / ritiro

Tipo negozio: bancone + pizzaiolo; niente rider. Chiusura = turno + incassi.

### 3.3 Delivery

Ordine in area → preparazione → desk assegna → rider in viaggio → prova consegna → consegnato.

**Regole:** fuori area → blocca; senza prova obbligatoria → non chiudere; rider assente → riassegna.

**Gap:** VRP ricco, SLA cliente, SMS/WA, aggregator esterni.

### 3.4 Web (vetrina)

Menu → slot forno → checkout → (Stripe) attesa pagamento → preparazione → stampa comanda web se parametro ON.

**Regole:** slot pieno → rifiuta; non pagato → non satura forno; antifraud velocity.

**Eccezioni:** abbandono Stripe → attesa da gestire; dominio non proprio → esperienza marca debole.

---

## 4. Reparti tablet

| Reparto | Job |
|---------|-----|
| Pizzaiolo | Forno / pizze |
| Cucina | Non-pizza / prep |
| Bancone | Allestimento ritiro |
| Delivery | Uscite e cortesia (se configurata) |

**Regola:** stesso ordine, viste diverse; Realtime (o refresh) per stati.

**Gap:** audit “chi ha cambiato stato”; kiosk logout; permessi per *azione* oltre che per area.

---

## 5. Home operativa — Aree di lavoro

| Passo | Attore | Azione | Esito |
|-------|--------|--------|-------|
| 1 | Staff | Apre area operativa | Vede **Aree di lavoro** |
| 2 | Staff | Sceglie Cassa / Cucina / … | Entra nel reparto consentito |
| 3 | Se nessuna area | Messaggio: chiedi admin di abilitare in Dipendenti | Non “servizi piano” confusi |

**Regola:** admin/owner → tutte le aree; operatore → solo aree spuntate + default ruolo.

**DoD:** nessuno resta su home vuota senza spiegazione comprensibile.

---

## 6. Turni cassa

| Passo | Azione | Esito |
|-------|--------|-------|
| 1 | Apri turno su PV attivo | Stato “turno aperto” |
| 2 | Lavora cassa | Ordini collegati al turno |
| 3 | Chiudi con fondo contato | Riconciliazione vs atteso |

**Copy prodotto:** linguaggio gestore (apri/chiudi, fondo), **mai** nomi infrastruttura.

---

## 7. Area cliente / Admin / Super Admin (sintesi)

- **Cliente:** menu, account, storico, fidelity UI; carta live ancora bloccata da Stripe live.  
- **Admin tenant:** menu, orari, parametri, ruoli, report base, magazzino hub, contabilità locale.  
- **Super Admin:** Demo live, Sala QA, go-live, roadmap, **moduli agenti** (strumento piattaforma, non sala).

---

## 8. Francy — cosa “tiene” la serata oggi

| Capacità | Stato prodotto |
|----------|----------------|
| Cassa + turni + PV | Operativo |
| Reparti + Realtime | Operativo |
| Delivery + proof | Operativo |
| Stampa comanda web | ON (percorso primario online) |
| Flusso stampa cassa/tablet/cortesia | Disponibile in prodotto (config gestore) |
| Stripe live | **Bloccato** (chiavi) |
| Dominio menu proprio | **Bloccato** (DNS/cutover) |
| RT / SDI | Fuori perimetro finché non c’è vendor |

**Sintesi:** sala e delivery sì; canale carta vera e URL marca ancora no.

---

## 9. Gap prodotto (requisiti, non ticket)

### Critici go-live online Francy

1. Stripe **live** + smoke serata.  
2. Dominio vetrina + Auth reset sul dominio.  
3. Decisione notifiche cliente: restare su stampa sala **oppure** SMTP/SMS/WA.

### Compliance / medio termine

4. RT/SDI + commercialista.  
5. POS certificato se richiesto dal locale.

### Operatività

6. Audit reparti + kiosk.  
7. Magazzino valorizzato / inventari.  
8. Report executive / multi-PV.  
9. Aggregator delivery; API partner; billing SaaS.

---

## 10. Priorità prodotto (ora)

| # | Priorità | Perché in sala |
|---|----------|----------------|
| **1** | Stripe live Francy | Online = soldi veri |
| **2** | Dominio menu Francy | Link clienti / brand |
| **3** | Formazione gestore su **stampa operativa** (solo cassa vs tablet) | Evita doppie stampe / cortesia assente |
| **4** | Canale notifiche vs “solo stampa” | Aspettative cliente |
| **5** | Percorso RT | Obblighi esercente |
| **6** | Audit tablet + magazzino valorizzato | Qualità e costi |

Non prioritizzare ora vs go-live: Glovo, SSO, BI pesante.

---

## 11. DoD — tenant “operativamente online sul web”

1. Cliente paga **live** → ordine in preparazione.  
2. In sala arriva comanda (stampa web o equivalente accettato).  
3. Reparti vedono l’ordine senza Super Admin.  
4. Delivery (se attivo) chiude con prova.  
5. Dominio vetrina = quello comunicato ai clienti.  
6. Nessun dato di altri tenant.

**Al 2026-08-05:** Francy ~ ok su 2–4 e 6; **mancano 1 e 5**. Stampa operativa cassa/tablet è disponibile come leva di processo sala (indipendente da Stripe).

---

## 12. Intake prodotto (per la prossima feature)

Prima di chiedere codice, compilare:

1. Nome feature e contesto (cassa / cucina / delivery / web / admin).  
2. Flusso felice (attore → azione → esito).  
3. Regole se/allora.  
4. Eccezioni + messaggio atteso.  
5. DoD sala in 1–3 frasi.  
6. Cosa **non** fare (anti-scope).

**Prompt Cursor:**  
`@agents/product.md Feature: <nome>. Contesto: <cassa|cucina|…>. Descrivi flusso, regole, eccezioni e DoD sala. Non scrivere codice.`

---

*Documento prodotto — solo flussi, regole e priorità.*  
*Prossima revisione consigliata: dopo smoke Stripe live + cutover dominio Francy, oppure dopo prima settimana di uso reale del flusso stampa tablet/cortesia.*
