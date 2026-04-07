# Analisi perimetro fiscale (IT) e questionario per lo sviluppo

**Ruolo del documento:** strumento da **dev manager / product engineering** per allineare **normativa italiana**, **esigenze operative della pizzeria** e **requisiti software** prima e durante l’implementazione (cassa, registratore, integrazioni).  
**Non è consulenza legale o fiscale:** le obbligazioni concrete dipendono da circolari, decreti e dal tuo specifico caso (forma giuridica, codice ATECO, volumi, dispositivi già in uso). Ogni sezione critica va **validata con un commercialista / consulente fiscale abilitato**.

**Come usarlo:** compila le sezioni in fondo (template risposte) man mano che rispondi; il team sviluppo userà le risposte per **priorità**, **modello dati** e **integrazioni** senza ambiguità.

---

## 1. Perché serve un perimetro chiaro (ingegneria)

In Italia, la **gestione degli incassi** in attività di somministrazione alimenti e bevande è soggetta a regole su:

- **Corrispettivi** (documento fiscale di vendita al pubblico) e relative **modalità di trasmissione** all’Agenzia delle Entrate (evoluzione storica: dagli scontrini cartacei al **registratore telematico** e **trasmissione telematica dei corrispettivi**).
- **Registri e conservazione** di dati rilevanti per controlli e adempimenti.
- **Coerenza** tra ciò che il cliente paga, ciò che viene registrato e ciò che viene trasmesso.

Il software gestionale (come Pizza Manager) può:

- restare **gestionale puro** (ordini, cucina, report interni), oppure
- integrarsi con **dispositivi o servizi certificati** che materializzano l’obbligo fiscale.

**Separare nettamente** è una decisione architetturale: vedi `docs/ROADMAP_CASSA_ENTERPRISE.md` (Blocco C).

---

## 2. Glossario minimo (senza claim di completezza)

| Termine | Significato pratico (livello prodotto) |
|--------|----------------------------------------|
| **Corrispettivo** | Documento fiscale emesso in caso di vendita al pubblico (nel tempo: scontrino, RT, ecc. secondo normativa applicabile). |
| **Registratore telematico (RT)** | Dispositivo/sistema certificato per la registrazione e la trasmissione dei corrispettivi secondo le regole vigenti. |
| **Trasmissione telematica** | Invio dei dati dei corrispettivi all’Amministrazione finanziaria secondo i canali e le specifiche previste (evolvono nel tempo). |
| **Software di cassa / gestionale** | Applicazione che gestisce ordini e incassi; **solo se** progettato e certificato secondo i requisiti normativi può essere parte della catena fiscale; altrimenti resta supporto operativo. |
| **Chiusura fiscale / giornata** | Operazioni di fine periodo (giornaliero o altro) con regole definite dal dispositivo normativo e dal fornitore. |
| **Annullamento / storno** | Regole molto stringenti: non sono “cancellazioni libere” in DB; spesso richiedono **documenti di rettifica** o procedure sul dispositivo. |
| **IVA** | Imposta sul valore aggiunto; aliquote e casistiche (es. alimenti take-away vs consumo) possono influenzare **configurazione prodotti** e **totali**. |
| **Documento commerciale** | Ricevuta, ordine web, comanda: **non** sono automaticamente il corrispettivo fiscale. |

---

## 3. Quadro normativo italiano (visione ingegneristica)

Questa sezione **non** elenca articoli aggiornati al giorno; serve a **orientare** analisi e domande al commercialista.

### 3.1 Linee generali (evolutive)

- Gli esercenti di attività commerciali sono soggetti a **obblighi di documentazione** delle vendite al pubblico (cornice: **DPR 633/1972** e successive modifiche, decreti e provvedimenti dell’Agenzia delle Entrate).
- L’Italia ha progressivamente introdotto obblighi di **strumenti di rilevazione e trasmissione** dei corrispettivi (nel tempo: **registratore telematico**, **trasmissione telematica**, specifiche tecniche pubblicate dall’Agenzia delle Entrate e aggiornate).
- **Software** che partecipa alla catena fiscale deve rispettare **requisiti tecnici** (storico: decreti ministeriali su “misuratori fiscali”, tracciabilità, ecc. **— verificare testo vigente** con il professionista).

### 3.2 Cosa implica per un’app SaaS (Pizza Manager)

| Scenario | Implicazione tipica |
|----------|---------------------|
| **A)** L’esercente usa un **RT / POS esterno** già in uso | L’app gestisce **ordini e totali**; l’emissione del corrispettivo avviene **sul dispositivo certificato** (integrazione o doppio passaggio operativo). Serve **allineamento** importi, pagamenti, annulli. |
| **B)** Si vuole **integrazione diretta** (API/SDK fornitore RT/POS) | Serve **scelta vendor**, **ambiente di test**, **certificazione** o checklist fornitore, **mapping** stato ordine ↔ documento fiscale. |
| **C)** **Nessun hardware** in fase 1 | Si implementa **audit**, **tracciabilità**, **export** e **modello dati** pronti per C2 in `ROADMAP_CASSA_ENTERPRISE.md`; **nessuna** emissione fiscale dall’app. |

### 3.3 Temi spesso discussi in sede di commercialista

- **Regime IVA** dell’attività (ordinario, forfettario se applicabile, esenzioni) e **aliquote** su pizze, bevande, coperto, servizio.
- **Corrispettivo** vs **fattura** (B2B, turisti, soglie, ecc.).
- **Esterometro / SDI** (se fatturazione elettronica verso PA o B2B): **perimetro SDI** è distinto dal corrispettivo RT, ma il gestionale può dover collegare **documenti** se il business lo richiede.
- **Conservazione** scontrini/corrispettivi e log (anche digitale) secondo prassi e indicazioni vigenti.

### 3.4 Rischio per lo sviluppo se si ignorano questi punti

- Costruire **un solo “ordine”** che mescola gestionale e fiscale senza modello separato → **difficili** annulli, chiusure e certificazioni.
- **Arrotondamenti e sconti** senza traccia immutabile → contestazioni in audit.
- **Offline** (coda locale) prima di regole **RT** → rischio di numerazioni o stati inconsistenti.

---

## 4. Punti chiave da analizzare (checklist esaustiva)

### 4.1 Profilo dell’esercente (chi siamo in produzione)

| # | Domanda | Perché serve allo sviluppo |
|---|---------|----------------------------|
| 4.1.1 | Forma giuridica (ditta individuale, SRL, …) e **P.IVA** attiva? | Incide su fatturazione, SDI, delegazioni. |
| 4.1.2 | **Codice ATECO** principale e attività effettiva (asporto, tavolo, delivery)? | Incide su IVA, obblighi, interpretazione corrispettivi. |
| 4.1.3 | Un **locale** o **rete multi-PV** (già gestita nell’app)? | PV, turni, report, eventuale RT per PV. |
| 4.1.4 | Esiste già un **commercialista** o **responsabile fiscale** di riferimento per il progetto? | Punto di validazione per ogni release “fiscale”. |

### 4.2 Stato attuale dell’obbligo fiscale “in cassa”

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.2.1 | **Cosa usate oggi** per emettere corrispettivi? (RT marca/modello, cassa tradizionale, solo gestionale, altro) | Determina integrazione vs convivenza. |
| 4.2.2 | Il dispositivo è in **noleggio** o **acquisto**? C’è **contratto manutenzione** con aggiornamenti normativi? | Dipendenze da vendor e finestra di test. |
| 4.2.3 | **Trasmissione** dei corrispettivi: già in regola? (es. verifiche con commercialista) | Baseline compliance. |
| 4.2.4 | **Chiusura giornaliera** e **cancellazioni**: come le fate oggi (operativamente)? | Progettazione annulli e audit nell’app. |

### 4.3 Operatività pizzeria (canali e pagamenti)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.3.1 | Mix di canali: **banco**, **telefono**, **app/web**, **aggregatori**, **delivery proprio**? | Ogni canale può avere tempi di pagamento e prove diverse. |
| 4.3.2 | **Pagamenti**: contanti, carta, Satispay, voucher, buoni pasto, **misto**? | Mapping su RT e split incassi. |
| 4.3.3 | **Sconti** (globali, promozioni, fedeltà): chi autorizza e qual è la **tracciabilità** richiesta internamente? | Già parzialmente coperto da audit cassa nel repo. |
| 4.3.4 | **Mance** e **arrotondamenti** contanti: politica locale? | Regole di arrotondamento (es. 5 cent) e coerenza con corrispettivo. |

### 4.4 Requisiti di prodotto (funzionali)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.4.1 | Obiettivo: **solo tracciabilità gestionale** oppure **emissione corrispettivo dall’app**? | Scoping architetturale massimo. |
| 4.4.2 | Serve **stampa** fiscale (o ricevuta) **automatica** da ogni ordine? | Driver stampanti, driver RT. |
| 4.4.3 | **Cliente finale** deve ricevere **QR / XML / email** dal dispositivo normativo? | UX e integrazioni. |
| 4.4.4 | **Multi-lingua** / **valuta** solo EUR? | Vincoli formattazione e IVA. |

### 4.5 Requisiti tecnici e integrazioni

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.5.1 | **Vendor preferito** per RT/POS (se noto): PAX, Ingenico, Epson fiscal, altro? | SDK, protocolli, certificazione. |
| 4.5.2 | **Ambiente di test** (sandbox) disponibile dal vendor? | CI/CD e QA. |
| 4.5.3 | **Rete locale** vs **cloud**: dove gira l’app (browser, Electron, tablet Android)? | Dove si aggancia il driver. |
| 4.5.4 | **Latenza** accettabile tra “conferma ordine” e “corrispettivo emesso”? | UX e transazioni. |
| 4.5.5 | **Offline**: obbligatorio prima o dopo il modulo fiscale? | Ordine in `ROADMAP_CASSA_ENTERPRISE.md` (Blocco B dopo cassa stabile). |

### 4.6 Dati e conformità (GDPR, log, conservazione)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.6.1 | Quali **dati personali** compaiono su corrispettivi/ricevute (nome, CF)? | Minimizzazione e privacy. |
| 4.6.2 | **Durata conservazione** log ordini e audit richiesta internamente? | Policy retention DB. |
| 4.6.3 | **Accesso** ai log: solo titolare, anche commercialista? | Ruoli e export. |

### 4.7 SDI e fatturazione elettronica (perimetro spesso parallelo al RT)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.7.1 | Emissione **fattura** (B2B, turisti, importi) **frequente**? | Modulo separato o integrato. |
| 4.7.2 | Uso di **intermediario SDI** (commercialista, piattaforma)? | API e credenziali. |
| 4.7.3 | **Notifiche** (scarti, esiti) da mostrare in app? | Workflow e supporto. |

### 4.8 Sicurezza e organizzazione

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.8.1 | Chi è **owner** del go-live fiscale lato cliente? | RACI. |
| 4.8.2 | **Formazione** operatori cassa prevista? | UX e messaggi di errore. |
| 4.8.3 | **Piano di rollback** se dispositivo RT non in linea? | Procedure operative (non solo codice). |

---

## 5. Domande da portare al commercialista (lista sintetica)

Porta questa lista in riunione; **segnati le risposte** nel template sotto.

1. **Obbligo attuale** per i nostri punti vendita: RT, solo trasmissione, altro?  
2. **Compatibilità** tra il nostro flusso ordini (web + cassa) e l’obbligo di corrispettivo: un documento per ordine o casi eccezionali?  
3. **Annulli e rimborsi**: sequenza legale corretta se il gestionale ha già confermato l’ordine?  
4. **Arrotondamenti** e **sconti** a cassa: come devono comparire sul corrispettivo?  
5. **IVA** su prodotti misti (asporto, consegna, al tavolo): configurazione minima richiesta nel sistema?  
6. **Conservazione** dati: cosa serve esportare in caso di controllo?  
7. **Integrazione software** con fornitore X: **vincoli** o **certificazioni** da rispettare?  
8. **Roadmap normativa** nota: aggiornamenti previsti in 12–24 mesi che impattano i POS?

---

## 6. Come il team sviluppo userà le tue risposte

| Tua risposta (esempio) | Effetto su backlog e architettura |
|------------------------|-----------------------------------|
| “RT già in uso, marca Y” | Integrazione con SDK Y; niente emissione fiscale custom in app. |
| “Solo gestionale + RT manuale” | Doppio passaggio operativo; focus su **allineamento importi** e **audit**. |
| “Vogliamo corrispettivo dall’app” | Blocco C completo; vendor + certificazione + modello dati separato. |
| “Multi-PV + turni” | Già in parte implementato; estensione a **chiusura fiscale per PV** se richiesto. |
| “Offline obbligatorio subito” | Rischio conflitto con RT; **sequenza** da `ROADMAP_CASSA_ENTERPRISE.md` (B dopo A stabile). |

---

## 7. Riferimenti nel repository

| File | Contenuto |
|------|-----------|
| `docs/ROADMAP_CASSA_ENTERPRISE.md` | Fasi cassa → offline → fiscale IT. |
| `docs/BACKLOG_E_STATO_SVILUPPO.md` | Stato backlog e vincoli esterni. |
| `docs/ARCHITETTURA_E_STATO.md` | Route vs implementazione. |
| `sql/sql_upgrade.sql` / `supabase/migrations/` | Migrations DB (audit, turni, ecc.). |

---

## 8. Template risposte (compila progressivamente)

*Copia le righe in un documento personale o espandi qui sotto.*

### 8.1 Profilo esercente

- Forma giuridica / P.IVA:  
- ATECO / descrizione attività:  
- Numero punti vendita:  
- Referente fiscale (nome / studio):  

### 8.2 Dispositivi e obblighi correnti

- Dispositivo corrispettivi oggi (marca/modello):  
- Trasmissione telematica: sì / no / in corso:  
- Note commercialista:  

### 8.3 Operatività

- Canali vendita (% o priorità):  
- Tipi di pagamento:  
- Politica sconti / fedeltà / mance:  

### 8.4 Obiettivo prodotto (12 mesi)

- Emissione fiscale dall’app: sì / no / da definire:  
- Vendor hardware preferito:  
- Vincoli offline:  

### 8.5 SDI / fatture

- Fatturazione elettronica: sì / no / frequenza:  
- Intermediario:  

### 8.6 Note libere

-  

---

## 9. Prossimi passi (processo dev manager)

1. **Compilare** almeno le sezioni 8.1–8.3.  
2. **Incontro** con commercialista usando la sezione 5.  
3. **Decisione** su scenario A/B/C (sezione 3.2).  
4. **Backlog** tecnico: modello “documento fiscale” separato, integrazione vendor, test (allineato a `ROADMAP_CASSA_ENTERPRISE.md`).  
5. **Revisione** trimestrale di questo documento (normativa e prodotto cambiano).

---

*Documento creato per supportare analisi e pianificazione. Aggiornare data e riferimenti normativi con il commercialista. Ultima revisione documento: 2026-04-06.*
