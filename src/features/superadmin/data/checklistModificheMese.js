/**
 * Checklist Super Admin — modifiche ultimo mese (linguaggio prodotto).
 * Ogni voce ha un `codice` (es. DM-02): citarlo in chat per far adattare il lavoro.
 * Le voci sono raggruppate per **epic** (capitolo) e **area** (blocco funzionale).
 * Mappa file/SQL: checklistMeseRoadmap.js (non in UI).
 *
 * Batch smoke consigliato (2026-08-07): vedi CHECKLIST_BATCH_TEST_PRIORITA.
 */

/** Codici da smoke-testare per primi (sessione feedback 7 ago 2026 foto 1–9). */
export const CHECKLIST_BATCH_TEST_PRIORITA = Object.freeze([
  "DM-02",
  "DM-04",
  "CL-06",
  "CL-07",
  "CL-09",
  "CL-10",
  "OW-05",
  "CA-10",
  "CA-11",
  "CA-12",
  "CA-13",
  "CA-14",
  "OP-07",
])

/** @typedef {'demo'|'cliente'|'ordini'|'cassa'|'admin'|'esperienza'|'database'|'piattaforma'|'sicurezza'} EpicId */

/**
 * @typedef {{
 *   codice: string,
 *   epic: EpicId,
 *   area: string,
 *   titolo: string,
 *   contesto: string,
 *   richiesta: string,
 *   comeVerificare: string[],
 *   urgenza: 'alta'|'media'|'bassa',
 *   prontoDaProvare: boolean,
 *   noteTraccia?: string,
 * }} ModificaMeseItem
 */

/** @type {ReadonlyArray<{ id: EpicId, titolo: string, ordine: number }>} */
export const CHECKLIST_EPIC_LABELS = Object.freeze([
  { id: "demo", titolo: "Demo Super Admin (reparti)", ordine: 1 },
  { id: "cliente", titolo: "Area cliente (casa)", ordine: 2 },
  { id: "ordini", titolo: "Ordini dal sito e pagamenti", ordine: 3 },
  { id: "cassa", titolo: "Cassa e planning consegne", ordine: 4 },
  { id: "admin", titolo: "Impostazioni del locale (admin)", ordine: 5 },
  { id: "esperienza", titolo: "Schermate più chiare", ordine: 6 },
  { id: "database", titolo: "Database (lato server)", ordine: 7 },
  { id: "piattaforma", titolo: "Piattaforma e affidabilità", ordine: 8 },
  { id: "sicurezza", titolo: "Sicurezza multi-locale", ordine: 9 },
])

/**
 * Aree = blocchi sotto lo stesso capitolo (es. profilo vs storico).
 * `ordine` relativo all’interno dell’epic.
 * @type {ReadonlyArray<{ id: string, epic: EpicId, titolo: string, ordine: number }>}
 */
export const CHECKLIST_AREA_LABELS = Object.freeze([
  { id: "demo_reparti", epic: "demo", titolo: "Giro operativo demo", ordine: 1 },

  { id: "cliente_demo", epic: "cliente", titolo: "Area demo cliente (da Super Admin)", ordine: 1 },
  { id: "cliente_accesso", epic: "cliente", titolo: "Accesso e menù", ordine: 2 },
  { id: "cliente_ordine", epic: "cliente", titolo: "Ordine dal menù (carrello e pizze)", ordine: 3 },
  { id: "cliente_profilo", epic: "cliente", titolo: "Profilo, registrazione e indirizzo", ordine: 4 },
  { id: "cliente_storico", epic: "cliente", titolo: "Storico e ripeti ordine", ordine: 5 },

  { id: "ordini_accettazione", epic: "ordini", titolo: "Accettazione e checkout", ordine: 1 },
  { id: "ordini_pagamenti", epic: "ordini", titolo: "Pagamenti online", ordine: 2 },
  { id: "ordini_capacita", epic: "ordini", titolo: "Capacità consegne", ordine: 3 },

  { id: "cassa_planning", epic: "cassa", titolo: "Planning e pony", ordine: 1 },
  { id: "cassa_stampa", epic: "cassa", titolo: "Stampa comanda", ordine: 2 },
  { id: "cassa_fidelity", epic: "cassa", titolo: "Fedeltà in cassa", ordine: 3 },
  { id: "cassa_ricevuta", epic: "cassa", titolo: "Ricevuta di cortesia", ordine: 4 },
  { id: "cassa_paylink", epic: "cassa", titolo: "Pay-by-link (carta da casa)", ordine: 5 },
  { id: "cassa_modifica_pizza", epic: "cassa", titolo: "Modifica pizza in cassa", ordine: 6 },

  { id: "cassa_parametri", epic: "cassa", titolo: "Parametri cassa (chi può modificarli)", ordine: 7 },
  { id: "cassa_pagamenti_test", epic: "cassa", titolo: "Test pagamenti carta / automatici", ordine: 8 },

  { id: "admin_parametri", epic: "admin", titolo: "Parametri e vetrina", ordine: 1 },
  { id: "admin_credenti", epic: "admin", titolo: "Credenziali e archivio password", ordine: 2 },
  { id: "admin_menu", epic: "admin", titolo: "Menu e ingredienti", ordine: 3 },
  { id: "admin_pagamenti_sistemi", epic: "admin", titolo: "Catalogo sistemi pagamento (fuori cassa)", ordine: 4 },
  { id: "admin_stampa", epic: "admin", titolo: "Flusso stampa (admin / SA)", ordine: 5 },

  { id: "ux_login", epic: "esperienza", titolo: "Login e header", ordine: 1 },
  { id: "op_reparti", epic: "esperienza", titolo: "Reparti sala (cucina / bancone / pizzaiolo)", ordine: 2 },
  { id: "op_shell", epic: "esperienza", titolo: "Shell area operativa", ordine: 3 },

  { id: "db_moduli", epic: "database", titolo: "Moduli SQL remoti", ordine: 1 },

  { id: "plat_ingresso", epic: "piattaforma", titolo: "Ingresso e CI", ordine: 1 },

  { id: "sec_isolamento", epic: "sicurezza", titolo: "Isolamento locali", ordine: 1 },
])

/** @type {readonly ModificaMeseItem[]} */
export const CHECKLIST_MODIFICHE_MESE = Object.freeze([
  // ── Demo reparti ──
  {
    codice: "DM-01",
    epic: "demo",
    area: "demo_reparti",
    titolo: "Giro demo dei reparti dal Super Admin",
    contesto:
      "Dopo il login Super Admin, dalla pagina di ingresso puoi aprire la demo sul locale di prova e passare tra cassa, forno, cucina, bancone e consegne senza rifare il login.",
    richiesta:
      "Deve esserci un’entrata chiara «Area demo» che ti porta già dentro il giro operativo del locale demo, con indicazione che sei in modalità demo.",
    comeVerificare: [
      "Dalla pagina dopo il login, a destra apri Area demo",
      "Arrivi nei reparti del locale di prova (non su una pagina vuota)",
      "Si capisce che stai facendo una demo (banner o etichetta)",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Area demo cliente ──
  {
    codice: "DM-02",
    epic: "cliente",
    area: "cliente_demo",
    titolo: "Entrata Area cliente demo senza rifare il login Super Admin",
    contesto:
      "Dalla demo operativa puoi entrare come Cliente Test (menù da casa). Poi, con il tasto Super Admin, torni ai reparti senza passare di nuovo dalla schermata «dove vuoi andare».",
    richiesta:
      "Post-login SA → Area demo → Area cliente già autenticato; da lì Super Admin riporta all’hub demo (non al gate di ingresso e non a /login).",
    comeVerificare: [
      "Da Hub demo apri «Area cliente» (Cliente Test) — non solo Vetrina da staff",
      "Vedi il menù come un cliente, senza chiedere di nuovo email/password SA",
      "In alto compare Super Admin (non solo Esci)",
      "Clic Super Admin → torni all’hub demo operativa in pochi secondi, senza passare dal login",
    ],
    noteTraccia:
      "2026-08-07 feedback: DM-02 — se clicco Super Admin mi manda fuori al login seppur sia loggato come SA; problema già riscontrato e troppo lento il passaggio. Fix in corso: verify getSession post-restore + replace verso /operative/dashboard.\n" +
      "2026-08-21/22 nuovo riscontro (area admin, non area cliente): dal pannello Admin del locale in giro demo, il tasto «Home Super Admin» rimandava di nuovo in area demo invece che a /superadmin/ingresso, con ~5s di latenza. Causa in SaHomeButton.jsx: il tenant di supporto restava salvato in localStorage (pm_sa_support_tenant) anche dopo il click; solo il flag _demo_giro in sessionStorage veniva pulito. Fix: click ora pulisce anche il localStorage (clearSupportTenantOverride). Verificato live in Chrome: /superadmin/ingresso pulito, nessun bounce, nessun support_tenant residuo in URL.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "DM-03",
    epic: "cliente",
    area: "cliente_demo",
    titolo: "Apertura area cliente demo senza attesa lunga",
    contesto:
      "Prima, entrando in area cliente demo, la schermata restava ferma a lungo su «Verifica accesso…».",
    richiesta:
      "L’area cliente demo deve aprirsi in pochi secondi e mostrare subito menù/account.",
    comeVerificare: [
      "Apri Area cliente dalla demo",
      "Entro pochi secondi vedi menù o header account, non uno spinner infinito",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "UX-02",
    epic: "cliente",
    area: "cliente_demo",
    titolo: "Header cliente demo: niente «Registrazione demo»",
    contesto:
      "In demo cliente compariva un tasto Registrazione poco utile; serviva tornare al menù e andare al checkout.",
    richiesta:
      "Togliere Registrazione demo dall’header; tenere Menù e Completa l’ordine quando gli ordini online sono attivi.",
    comeVerificare: [
      "In area cliente demo: non c’è Registrazione demo",
      "Ci sono Menù e Completa l’ordine (se online attivo)",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },

  // ── Accesso e menù ──
  {
    codice: "CL-01",
    epic: "cliente",
    area: "cliente_accesso",
    titolo: "Dopo il login cliente si apre il menù",
    contesto:
      "Il cliente che accede dal sito della pizzeria deve trovare subito il menù per ordinare.",
    richiesta:
      "Login → menù/vetrina. Dal nome in alto si modifica il profilo; «Ultimi ordini» e «Menù» a portata di mano.",
    comeVerificare: [
      "Accedi come cliente → atterri sul menù",
      "Clic sul nome → profilo in modifica",
      "Ultimi ordini mostra gli ultimi tre; Menù riporta alla vetrina",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CL-07",
    epic: "cliente",
    area: "cliente_accesso",
    titolo: "Login esterno Cliente Test = area cliente reale (non chrome demo)",
    contesto:
      "Se accedi da /login con le credenziali Cliente Test (senza passare da Area demo SA), non deve apparire «Esci (riapri demo)»: sei un cliente vero sul menù.",
    richiesta:
      "Login esterno → vetrina cliente senza flag demo; Super Admin solo se sei entrato dalla demo con sessione salvata.",
    comeVerificare: [
      "Logout completo, login info@… da /login (senza aprire Area demo SA)",
      "Vedi Menù / nome / Ultimi ordini, senza «Esci (riapri demo)» né Hub demo",
      "Puoi aprire profilo e ordinare come un cliente reale",
    ],
    noteTraccia:
      "2026-08-07 Foto 7: login credenziali test / profilo — area consegna e pin mancanti (legato a CL-06). Login esterno non deve mostrare chrome demo.\n" +
      "2026-08-22: verificato via lettura codice — ClienteHeaderAccount.jsx mostra il pulsante Super Admin/«Esci (riapri demo)» solo se isDemoClienteSessionActive() è vera (sessione demo salvata), non per un login esterno diretto da /login. Sembra già corretto — da riconfermare con un test reale (logout completo + login diretto) prima di chiudere.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CL-04",
    epic: "cliente",
    area: "cliente_ordine",
    titolo: "Menù cliente loggato: carrello fisso a destra",
    contesto:
      "Con il cliente già dentro, non servono la grande fascia nera né i link centrali. Serve spazio al menù e un carrello sempre a destra.",
    richiesta:
      "Cliente loggato: togliere hero nero e nav centrale; carrello a larghezza fissa; in alto «Completa l’ordine».",
    comeVerificare: [
      "Entra come Cliente Test sul menù",
      "Non vedi la fascia nera grande né i tre link centrali",
      "A destra c’è il carrello sempre della stessa larghezza",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CL-08",
    epic: "cliente",
    area: "cliente_ordine",
    titolo: "Modifica pizza dal menù (come in cassa)",
    contesto:
      "Il cliente loggato deve poter personalizzare ingredienti/formato prima di mettere nel carrello, non solo aggiungere la pizza «così com’è».",
    richiesta:
      "Su categorie pizza: tasto Modifica pizza; riepilogo modifiche nel carrello; dati caricati anche senza ruolo staff.",
    comeVerificare: [
      "Cliente loggato → categoria Classiche → Modifica pizza",
      "Cambia un ingrediente / aggiungi extra → Aggiungi",
      "Nel carrello vedi il riepilogo; puoi ritoccare dalla matita",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Profilo ──
  {
    codice: "CL-05",
    epic: "cliente",
    area: "cliente_profilo",
    titolo: "Modifica profilo più larga + torna al menù",
    contesto:
      "Su schermi grandi il form restava troppo stretto; dal profilo serviva tornare al menù senza indovinare il percorso.",
    richiesta:
      "Ampliare l’area profilo/iscrizione; dal profilo un tasto chiaro «Torna al menù».",
    comeVerificare: [
      "Apri profilo in modifica: form più largo sul desktop",
      "Registrazione: stesso comportamento",
      "Torna al menù funziona",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-06",
    epic: "cliente",
    area: "cliente_profilo",
    titolo: "Indirizzo e mappa in profilo/registrazione",
    contesto:
      "A volte comparivano tanti avvisi di errore sulla mappa Google, poco chiari.",
    richiesta:
      "Messaggio in italiano se la mappa non carica; si può salvare l’indirizzo a mano. Se ok: suggerimenti e puntatore.",
    comeVerificare: [
      "Profilo o registrazione: campo indirizzo",
      "Con mappa ok: area di consegna del locale disegnata + pin sulla casa del cliente",
      "Il cliente può trascinare il puntatore o cliccare sulla mappa",
      "Se mappa in errore: messaggio chiaro in italiano + anteprima + pulsante Riprova mappa",
      "Si può comunque salvare l’indirizzo scritto a mano",
    ],
    noteTraccia:
      "2026-08-07 Foto 7 / CL-01+CL-07 profilo: non si vedeva l’area di consegna né il simbolo posizione esatta nonostante indirizzo Via Pontedera 4. Richiesto geocode + marker trascinabile + poligono area.\n" +
      "2026-08-21/22: stesso indirizzo (Via Pontedera 4, Padova 35124) ancora in errore: «La mappa interattiva non si è avviata correttamente». Chiave VITE_GOOGLE_MAPS_API_KEY presente e valida nel codice (nessun bug di codice trovato) — il messaggio stesso indica la causa: su Google Cloud manca Maps JavaScript API e/o Places API abilitate, fatturazione attiva, o le restrizioni della chiave non includono l'origine (http://localhost:5173/* in locale, dominio reale in produzione). Azione solo lato titolare account Google Cloud, non risolvibile da codice. Fallback (indirizzo scritto a mano + anteprima statica) funziona correttamente nel frattempo.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CL-02",
    epic: "cliente",
    area: "cliente_profilo",
    titolo: "Registrazione nuovo cliente e fidelity opzionale",
    contesto:
      "Dal sito il nuovo cliente crea l’account; se il locale ha fidelity, può iscriversi in registrazione o dal profilo.",
    richiesta:
      "Form chiaro sul locale giusto; casella fidelity se attiva; dal profilo iscrizione dopo.",
    comeVerificare: [
      "Apri registrazione sul locale demo",
      "Compila e registra: account creato",
      "Se fidelity attiva: vedi l’opzione",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Storico ──
  {
    codice: "CL-03",
    epic: "cliente",
    area: "cliente_storico",
    titolo: "Storico ordini: richiama, aggiungi o ripeti",
    contesto:
      "Da «Ultimi ordini» (e dallo storico in cassa) si riprende un ordine già fatto: dettaglio, aggiungi riga o ripeti tutto.",
    richiesta:
      "Apri ordine → Aggiungi / Ripeti → carrello/checkout. Ordini web incompleti collegati all’anagrafica se i dati coincidono.",
    comeVerificare: [
      "Cliente: Ultimi ordini → apri → Aggiungi o Ripeti",
      "Cassa: storico cliente → stessi controlli",
    ],
    noteTraccia:
      "2026-08-21/22: su «cliente test» (demo) il richiamo ordine non riusciva; da Cassa su un altro cliente funziona ma poco chiaro. L'elenco Cassa (Storico ordini) mostra già numero+totale+data per riga, cliccabile per il dettaglio prodotti (non un ID nudo) — probabilmente non notato durante il test. Richiesta aggiuntiva: un menu a tendina/espandibile per aprire più rapidamente senza il giro lista→dettaglio→«Torna all'elenco». Non ancora implementato: serve conferma se si vuole questo redesign (rischio di toccare un flusso cassa già in uso) prima di procedere.",
    urgenza: "media",
    prontoDaProvare: true,
  },

  // ── Ordini web ──
  {
    codice: "OW-01",
    epic: "ordini",
    area: "ordini_accettazione",
    titolo: "Accettazione ordini: automatica oppure dalla cassa",
    contesto:
      "Il gestore sceglie se il sistema accetta da solo gli ordini web oppure se la cassa deve accettare, spostare o rifiutare.",
    richiesta:
      "Parametri → Ordini web: Automatica / Manuale. In manuale: Accetta / Sposta / Rifiuta; non in cucina finché non Accetti.",
    comeVerificare: [
      "Admin → Parametri → Manuale e salva",
      "Ordine dal sito: in cassa «da accettare»",
      "Prova Accetta, Sposta, Rifiuta",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OW-02",
    epic: "ordini",
    area: "ordini_accettazione",
    titolo: "Dal sito solo consegna a domicilio",
    contesto: "Chi ordina da casa chiede la consegna; il ritiro resta in cassa.",
    richiesta: "Checkout vetrina solo consegna; blocco fuori zona; fasce con capacità forno.",
    comeVerificare: [
      "Checkout parla solo di consegna",
      "Indirizzo fuori area → non puoi confermare",
      "Fasce: prima delle 15:00 solo :45; dalle 15:00 in poi tutti i quarti (anche se apri il checkout prima delle 15)",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "OW-03",
    epic: "ordini",
    area: "ordini_pagamenti",
    titolo: "Pagamento online Stripe e/o SumUp",
    contesto: "Il locale può offrire carta online oltre al pagamento alla consegna.",
    richiesta: "Se configurato, il cliente sceglie il provider e paga.",
    comeVerificare: [
      "Con pagamento online attivo: al checkout vedi le opzioni carta",
      "Stripe: dopo conferma ordine, «Paga con carta» completa il pagamento (form non annidato)",
      "SumUp: conferma ordine → redirect hosted sandbox",
      "In Admin → Pagamenti online vedi le carte di test per gestore",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OW-04",
    epic: "ordini",
    area: "ordini_capacita",
    titolo: "In automatico considerare anche i pony disponibili",
    contesto:
      "Oggi l’accettazione automatica guarda soprattutto il forno; i pony non chiudono ancora da soli gli slot web.",
    richiesta:
      "Con accettazione automatica, tenere conto anche di quanti ragazzi consegna hai quel giorno.",
    comeVerificare: [
      "Imposta 1 pony e molte consegne nella stessa fascia",
      "Dal sito non deve essere troppo facile prenotare oltre la capacità consegna",
    ],
    urgenza: "media",
    prontoDaProvare: false,
  },

  // ── Cassa ──
  {
    codice: "CA-01",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Planning a tutto schermo con indirizzi, pizze e pony",
    contesto:
      "Planning in cassa: fasce con consegne e ritiri, divisi per pony. Solo la cassa sposta le consegne con l’ingranaggio.",
    richiesta:
      "Vista a righe; ingranaggio → selezioni → frecce → salva; consegne modificate con ✎.",
    comeVerificare: [
      "Cassa → Planning: vedi le fasce",
      "Con 2 pony: vedi A/… e B/…",
      "Sposta una consegna e salva; compare ✎",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-02",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Nel planning il numero conta solo le pizze",
    contesto: "Il numero dopo il trattino non deve includere bibite o fritti.",
    richiesta: "Nella riga «Via … — 5» il 5 è solo pizze.",
    comeVerificare: [
      "Ordine con 3 pizze e 2 bibite → in planning — 3",
    ],
    urgenza: "alta",
    prontoDaProvare: false,
  },
  {
    codice: "CA-03",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Segno ✎ anche in consegne / pony",
    contesto: "Se sposti una consegna in cassa, anche Delivery/Pony deve mostrare la modifica.",
    richiesta: "Stesso simbolo sulle schermate operative di consegna.",
    comeVerificare: [
      "Modifica in planning → apri Delivery/Pony: evidenziata",
    ],
    urgenza: "media",
    prontoDaProvare: false,
  },
  {
    codice: "CA-04",
    epic: "cassa",
    area: "cassa_stampa",
    titolo: "Stampa comanda e opzioni di stampa",
    contesto: "Per ordini web e cassa: stampa secondo impostazioni del locale.",
    richiesta: "Verificare stampa automatica/manuale e per reparto.",
    comeVerificare: [
      "Con stampa web ON: nuovo ordine web propone/parte la comanda",
      "Da cassa: stampa comanda",
      "Una riga pizza (ingredienti lunghi) non si spezza a metà tra due fogli/blocchi",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-05",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Planning aperto a tutta larghezza (nasconde Ordini e Carrello)",
    contesto:
      "Con Planning aperto su desktop, Ordini e Carrello competevano lo spazio: serviva la stessa logica del menù (pannello unico).",
    richiesta:
      "Aprendo Planning: solo planning a tutto schermo; chiudendo tornano Ordini e Carrello.",
    comeVerificare: [
      "Cassa desktop → Planning: non vedi colonne Ordini/Carrello",
      "Chiudi Planning: tornano",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-06",
    epic: "cassa",
    area: "cassa_fidelity",
    titolo: "Riepilogo fedeltà: premio raggiunto e uso sull’ordine",
    contesto:
      "Collegando una tessera si vedevano solo i punti, senza capire il premio né poterlo usare.",
    richiesta:
      "Mostrare premio raggiunto (o prossimo), checkbox «Usa premio» con sconto margherita e scala punti; lead time scheda reale.",
    comeVerificare: [
      "Cliente con punti sufficienti → box Premio raggiunto + Usa premio",
      "Conferma ordine: totale scontato e punti scalati",
      "Se manca margherita in listino: messaggio chiaro",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-07",
    epic: "cassa",
    area: "cassa_ricevuta",
    titolo: "Ricevuta: ogni aggiunta e rimozione ingredienti",
    contesto:
      "Sulla ricevuta di cortesia restava solo «Margherita (Normale)» senza Senza/Aggiunta.",
    richiesta:
      "Sotto ogni riga: Senza / Aggiunta / Abbondante / Poco; stesso testo chiaro in carrello e dettaglio ordine.",
    comeVerificare: [
      "Ordine con pizza modificata → stampa ricevuta",
      "Vedi Senza: … e/o Aggiunta: … sotto la riga",
      "In carrello riepilogo le modifiche in evidenza",
    ],
    noteTraccia:
      "2026-08-21/22: segnalato che su una stampa resta solo il nome pizza (senza Senza/Aggiunta) mentre sulle altre è corretto — non specificato quale delle 3 (comanda cucina, ricevuta cliente, ricevuta di cortesia). Verificato il codice: printComanda.js e printRicevuta.js includono entrambi ingredientiCotturaSummary, e printRicevutaCortesiaFromDetail in CassaPage.jsx riceve ordineDetail già arricchito da enrichOrdineDetailIngredientiSummaries — nessun bug trovato a lettura statica. Serve uno screenshot dello scontrino/comanda col problema per individuare il punto esatto prima di toccare codice di stampa (file critico, in uso operativo).",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-08",
    epic: "cassa",
    area: "cassa_paylink",
    titolo: "Link (carta da casa): pannello post-conferma anche se non configurato",
    contesto:
      "Scegliendo Link non appariva nessuna finestra: il flusso partiva solo se pay-by-link era già abilitato in impostazioni.",
    richiesta:
      "Dopo conferma compare sempre il pannello in basso; se non configurato: messaggio + Apri impostazioni; se ok: Registra/invia. Ripristinabile da dettaglio ordine.",
    comeVerificare: [
      "Riepilogo → Link (carta da casa) → Conferma: vedi pannello in basso",
      "Senza provider: messaggio ambra e Apri impostazioni cassa",
      "Con Pay-by-link ON + Stripe: Registra / invia richiesta link",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-09",
    epic: "cassa",
    area: "cassa_modifica_pizza",
    titolo: "Modifica pizza: prezzi unitari e varianti sempre visibili",
    contesto:
      "Su aggiunte e varianti (Abbondante/Poco/Senza) non si vedeva il costo; i chip + Ingredienti erano senza prezzo.",
    richiesta:
      "Pulsanti +ingrediente con (+x€); riga extra con prezzo della variante scelta; chip variante base con incluso/+x€; chip pizza aggiornato se modificata.",
    comeVerificare: [
      "Modifica Topolino → + Gamberetti mostra (+…€)",
      "Abbondante su patatine: prezzo sul chip e sul totale",
      "Cambia variante sull’extra: prezzo aggiornato",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Admin ──
  {
    codice: "AD-01",
    epic: "admin",
    area: "admin_parametri",
    titolo: "Parametri Ordini web leggibili",
    contesto: "Il titolare deve capire Automatica vs Manuale in italiano.",
    richiesta: "Sezione chiara; salvataggio persistente.",
    comeVerificare: [
      "Admin → Parametri → Ordini web",
      "Cambia, salva, ricarica: resta impostato",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "AD-02",
    epic: "admin",
    area: "admin_parametri",
    titolo: "Vetrina demo sul locale giusto",
    contesto: "Aprendo vetrina/demo dal SA, menù e dati del locale scelto.",
    richiesta: "Con locale di supporto, anteprima usa quel locale.",
    comeVerificare: [
      "Da ingresso SA apri Vetrina: menù del tenant demo",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "AD-03",
    epic: "admin",
    area: "admin_credenti",
    titolo: "Archivio password: Super Admin vede tutti gli account staff",
    contesto:
      "In Clienti → Archivio password / Account attivi dovevano comparire tutte le note password del locale, non solo Super Admin.",
    richiesta:
      "Da SA: elenco completo staff + note (cassa, bancone, pony…). Persistenza note ok.",
    comeVerificare: [
      "Clienti → PizzaManager.it → Account attivi o Archivio password",
      "Vedi cassa@, bancone@, pony… con le password archiviate",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "AD-04",
    epic: "admin",
    area: "admin_credenti",
    titolo: "Archivio password: anche clienti con nota (es. Cliente Test)",
    contesto:
      "Le note password dei clienti fidelity/account non comparivano nell’archivio SA, solo lo staff.",
    richiesta:
      "Elenco unificato staff + clienti con note; SA/admin possono leggere clienti del tenant.",
    comeVerificare: [
      "Archivio password: compare info@… / Cliente Test con nota",
      "Staff resta visibile",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "AD-05",
    epic: "admin",
    area: "admin_menu",
    titolo: "Lista ingredienti: badge cottura + categoria colorata",
    contesto:
      "Con categoria affettato si perdeva «in cottura / a fine cottura» e il colore restava testo hex grezzo.",
    richiesta:
      "Sempre badge In cottura / A fine cottura (quest’ultimo senza sfondo pieno); se c’è categoria, rettangolo colorato col nome; niente hex in chiaro.",
    comeVerificare: [
      "Admin → Ingredienti: Bresaola → In cottura + Affettato colorato",
      "A fine cottura: bordo/testo senza riempimento colorato",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },

  // ── UX / operativo ──
  {
    codice: "UX-01",
    epic: "esperienza",
    area: "ux_login",
    titolo: "Login Super Admin senza testi inutili",
    contesto: "Sulla pagina di accesso c’erano frasi lunghe su staff vs cliente.",
    richiesta: "Login pulito: logo, email, password, Accedi.",
    comeVerificare: [
      "Apri il login piattaforma: non vedi i testi lunghi sotto il titolo",
    ],
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "OP-01",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Cucina/Bancone: chip preparazioni (aggiunte, fine cottura, categorie)",
    contesto:
      "Con solo le fasce orarie non si vedevano patatine, gamberetti o affettati da preparare.",
    richiesta:
      "Sezione Da preparare con chip colorati; includere Prep. cucina, categorie, fine cottura e aggiunte dal riepilogo; Bancone allineato.",
    comeVerificare: [
      "Ordine con Patatosa + gamberetti extra → Cucina fascia: chip Patatine e + Gamberetti",
      "Bancone: stessi ingredienti in elenco per orario",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-02",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Pizzaiolo: orario consegna + ritardo reale (pronte 10′ prima)",
    contesto:
      "Sulle consegne mancava l’orario; il ritardo partiva troppo presto (buffer 30′).",
    richiesta:
      "Mostrare orario cliente e «forno ≤ …»; ritardo solo dopo scadenza forno (default ~10′ viaggio); conteggi slot su orario preparazione.",
    comeVerificare: [
      "Consegna 19:15 → vedi 19:15 e forno ≤ 19:05",
      "Prima delle 19:05 non segnalare ritardo",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-03",
    epic: "esperienza",
    area: "op_shell",
    titolo: "Menu laterale area operativa solo con ☰",
    contesto:
      "La colonna sinistra restava sempre aperta e toglieva spazio a cassa/planning.",
    richiesta:
      "Sidebar nascosta; si apre con il tasto hamburger, si chiude con ✕, click fuori o Esc.",
    comeVerificare: [
      "Area operativa: niente colonna fissa a sinistra",
      "☰ apre il menu; Esc o backdrop chiude",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "OP-04",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Cucina: solo conteggi prep per fascia (niente Per: pizza / In forno)",
    contesto:
      "Con più patatine sulla stessa fascia comparivano chip separati «Per: Patatosa» e anche il riepilogo ordine.",
    richiesta:
      "Conteggio aggregato (es. 2× Patatine); tap marca tutto il gruppo; niente sezione In forno (resta ai Pizzaioli).",
    comeVerificare: [
      "Due pizze con patatine stessa fascia → un chip 2× Patatine (niente Per: …)",
      "Niente sezione In forno / riepilogo ordine in Cucina",
      "Tocca il chip: marca tutto il conteggio come pronto",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-05",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Tablet cucina opzionale: prep integrate nel Bancone",
    contesto:
      "Non tutti i locali hanno tablet in cucina: spegnendo il flag le prep devono stare sul Bancone appena inserisci l’ordine.",
    richiesta:
      "Cassa → Impostazioni → Tablet dedicato Cucina OFF: nav Cucina nascosta; Bancone «Da preparare» su IN_PREPARAZIONE. ON: area Cucina dedicata.",
    comeVerificare: [
      "Disattiva Tablet dedicato Cucina, salva, ricarica area operativa",
      "Menu: non vedi Cucina; Bancone mostra prep subito dopo conferma ordine",
      "Riattiva tablet: torna Cucina e Bancone senza crash",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-06",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Bancone / Cucina: nessuna schermata bianca all’apertura",
    contesto:
      "Dopo le modifiche prep, Bancone poteva andare in errore (ingredientNeedsPrepMonitor) e bloccare il layout.",
    richiesta:
      "Aprire Bancone e Cucina (o quad test) senza errori in console; elenco prep/ordini caricabile.",
    comeVerificare: [
      "Area operativa → Bancone: pagina ok, niente ReferenceError in console",
      "Cucina (se tablet ON) o Bancone con prep (se tablet OFF): chip o messaggio vuoto, non crash",
      "Opzionale: Sala QA / test reparti quad → pannello Bancone stabile",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Database ──
  {
    codice: "DB-01",
    epic: "database",
    area: "db_moduli",
    titolo: "Iscrizione fidelity lato server (remoto)",
    contesto: "L’iscrizione fidelity deve essere gestita in modo sicuro sul database live.",
    richiesta: "Funzione lato server applicata e funzionante.",
    comeVerificare: [
      "Da registrazione/profilo iscrivi fidelity su locale demo",
      "In admin/cassa il cliente risulta iscritto",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "DB-02",
    epic: "database",
    area: "db_moduli",
    titolo: "Accettazione cassa ordini web (remoto)",
    contesto: "Flag «in attesa cassa», accettazione e rifiuto sul database live.",
    richiesta: "Aggiornamento remoto applicato; prove Accetta/Rifiuta ok.",
    comeVerificare: [
      "Manuale: ordine web in attesa → Accetta / Rifiuta",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "DB-03",
    epic: "database",
    area: "db_moduli",
    titolo: "Limite pizze per fascia e antifrode",
    contesto: "Non accettare troppe pizze nella stessa fascia né troppi ordini anomali.",
    richiesta: "Regole di capacità e antifrode attive in produzione.",
    comeVerificare: [
      "Riempi una fascia: il sito non fa passare un altro ordine pieno",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "DB-04",
    epic: "database",
    area: "db_moduli",
    titolo: "Pacchetto affidabilità luglio–agosto sul database",
    contesto: "Aggiornamenti presenza SA, realtime ordini, foto/firma consegna, ecc.",
    richiesta: "Confermare sul progetto remoto senza rompere la serata.",
    comeVerificare: [
      "Ordini si aggiornano tra cassa e cucina senza ricaricare a mano",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "DB-05",
    epic: "database",
    area: "db_moduli",
    titolo: "Moduli SQL 48–50 (archivio SA, modifica pizza pubblica, clienti SA)",
    contesto:
      "Servono policy/RPC per archivio password completo, bundle modifica pizza in vetrina e lettura clienti da SA.",
    richiesta: "Moduli applicati sul progetto remoto e verificati in UI.",
    comeVerificare: [
      "AD-03/AD-04 e CL-08 funzionano sul tenant demo",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Piattaforma ──
  {
    codice: "IN-01",
    epic: "piattaforma",
    area: "plat_ingresso",
    titolo: "Ingresso Super Admin a tre destinazioni",
    contesto: "Pagina post-login SA e servizi di piattaforma rafforzati.",
    richiesta: "Tre scelte chiare: Amministrazione | Vetrina | Area demo.",
    comeVerificare: [
      "Login SA → tre scelte",
      "Amministrazione apre la console",
    ],
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "IN-02",
    epic: "piattaforma",
    area: "plat_ingresso",
    titolo: "Controllo automatico database raggiungibile (CI)",
    contesto: "Job automatico verifica che il database non fallisca in silenzio.",
    richiesta: "Il controllo automatico deve risultare verde.",
    comeVerificare: [
      "Nei controlli automatici del repository il keep-alive risulta ok",
    ],
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "IN-03",
    epic: "piattaforma",
    area: "plat_ingresso",
    titolo: "Residui: audit backend e test isolamento in CI",
    contesto: "Dal piano affidabilità restano audit dipendenze e test isolamento locali.",
    richiesta: "Chiudere e spuntare quando fatti.",
    comeVerificare: [
      "Documento programma affidabilità aggiornato",
    ],
    urgenza: "media",
    prontoDaProvare: false,
  },

  // ── Feedback sessione 2026-08-07 (foto 1–9) ──
  {
    codice: "DM-04",
    epic: "demo",
    area: "demo_reparti",
    titolo: "Pulsante DEMO dalle schermate operative → hub aree di lavoro",
    contesto:
      "In cucina/cassa/bancone il tasto «Home Super Admin» mandava al gate ingresso invece che all’hub demo (foto 4: Aree di lavoro).",
    richiesta:
      "Nelle schermate operative in giro demo il pulsante si chiama DEMO e porta a /operative/dashboard (hub foto 4), senza uscire dalla sessione demo.",
    comeVerificare: [
      "Entra in Area demo → apri Cucina",
      "Clic DEMO → torni a «Demo live / Aree di lavoro»",
      "Non finisci su /superadmin/ingresso né sul login",
    ],
    noteTraccia:
      "2026-08-07 Foto 4: Se dentro un’area tipo cucina clicco Home Super Admin voglio la schermata hub; rinominare il pulsante DEMO.\n" +
      "2026-08-21/22: rinomina/routing corretti (pulsante DEMO → /operative/dashboard funziona), ma segnalata lentezza: da Delivery, clic DEMO tornava alla pagina giusta ma con un reload completo della pagina (window.location.assign) invece di una navigazione client-side. Fix: ora usa navigate() di react-router. Verificato live: cambio pagina istantaneo, nessun reload del bundle.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-07",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Test 4 reparti: viste Bancone / Delivery / Cucina popolate",
    contesto:
      "Nella griglia «Test 4 reparti» Bancone e Delivery risultavano vuoti; Pizzaioli/Cucina con pochi dati (foto 5).",
    richiesta:
      "Le quattro viste devono mostrare ordini coerenti della sessione condivisa (non pannelli bianchi senza spiegazione).",
    comeVerificare: [
      "Crea ordini PRONTO / delivery di oggi",
      "Apri Test 4 reparti: Bancone e Delivery non sono vuoti senza motivo",
      "Se vuoti, messaggio chiaro (es. nessun ordine PRONTO oggi)",
    ],
    noteTraccia:
      "2026-08-07 Foto 5: Bancone in quad mostra tutti i PRONTO oggi (no finestra orario); Delivery mostra messaggio se vuoto invece di pannello bianco.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-10",
    epic: "admin",
    area: "admin_pagamenti_sistemi",
    titolo: "Catalogo sistemi pagamento fuori dall’operatività cassa",
    contesto:
      "In Impostazioni cassa compare «Catalogo sistemi (predisposto / attivato)» con Stripe/SumUp/Nexi/PayPal/POS — troppo confusionale per l’operatore (foto 1).",
    richiesta:
      "Spostare il catalogo in Admin tenant o meglio Super Admin (area privata). In cassa l’operatore non deve vedere predisposizione/attivazione sistemi.",
    comeVerificare: [
      "Operatore cassa: non vede Catalogo sistemi",
      "Admin o Super Admin: configura i sistemi dalla propria area",
    ],
    noteTraccia:
      "2026-08-07 Foto 1: molto confusionale — creare punto checklist. → Catalogo in Admin → Pagamenti online (PosPaymentIntegrationsPanel).\n" +
      "2026-08-22: verificato via lettura codice — PosPaymentIntegrationsPanel.jsx è importato solo da admin/pages/settings/PagamentiOnlinePage.jsx, nessun riferimento nell'area operativa cassa. Già spostato, da riconfermare visivamente in Cassa → Impostazioni prima di chiudere.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-11",
    epic: "admin",
    area: "admin_stampa",
    titolo: "Flusso stampa operativa solo admin / Super Admin",
    contesto:
      "«Flusso stampa operativa» (organizzazione tablet, copie, quando stampare) è nelle impostazioni cassa (foto 2) — non deve essere compito dell’operatore sala.",
    richiesta:
      "Impostazioni flusso stampa: Admin tenant al massimo; preferibile Super Admin in area privata. Operatore cassa non le vede.",
    comeVerificare: [
      "Cassa operatore: niente sezione Flusso stampa",
      "Admin/SA: può impostare organizzazione, tablet cucina, copie, timing",
    ],
    noteTraccia:
      "2026-08-07 Foto 2: troppe cose che non devono essere viste dall’operatività di cassa. → Admin Impostazioni → Stampa operativa.\n" +
      "2026-08-22: verificato via lettura codice — StampaOperativaSection.jsx vive solo sotto admin/pages/settings/, nessun riferimento nell'area operativa cassa. Già spostato, da riconfermare visivamente prima di chiudere.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-12",
    epic: "cassa",
    area: "cassa_parametri",
    titolo: "Parametri cassa: solo quelli operativi + report se modifica operatore",
    contesto:
      "Foto 3: pony, pizze/15 min, tempi preparazione, soglie, minuti forno — questi sì li può vedere/modificare l’operatore cassa. Il resto no.",
    richiesta:
      "In cassa restano solo i parametri operativi della foto 3. Ogni modifica da operatore genera riga su report automatico (audit).",
    comeVerificare: [
      "Operatore vede/modifica solo i campi operativi concordati",
      "Dopo una modifica compare nel report/audit",
    ],
    noteTraccia:
      "2026-08-07 Foto 3: unici parametri che operatore cassa può vedere e modificare; segnalare su report automatico. Audit event_type parametri_cassa_operatore.\n" +
      "2026-08-22: verificato via lettura codice — CassaImpostazioniPage.jsx usa già \"parametri_cassa_operatore\" come audit event_type. Da riconfermare visivamente (elenco campi mostrati + comparsa nel report) prima di chiudere.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OW-05",
    epic: "ordini",
    area: "ordini_pagamenti",
    titolo: "TEST PAGAMENTI CON CARTA E AUTOMATICI",
    contesto:
      "Pagamenti link/carta (Stripe/SumUp) ancora da stabilizzare; serve traccia dedicata nel report checklist.",
    richiesta:
      "Voce report «TEST PAGAMENTI CON CARTA E AUTOMATICI»: smoke Stripe + SumUp, pay-by-link, errori console/checkout.",
    comeVerificare: [
      "Stripe test: conferma ordine → Paga con carta completa",
      "SumUp sandbox: redirect hosted ok",
      "Pay-by-link da cassa: flusso chiaro",
      "Annotare esito nel report / note voce",
    ],
    noteTraccia:
      "2026-08-07: TEST PAGAMENTI — carte test in Admin Pagamenti; CL-10 soft finalize Stripe; smoke manuale Stripe/SumUp/pay-by-link da annotare in note voce.\n" +
      "2026-08-22: questa voce è un promemoria di test manuale (smoke pagamenti reali), non un bug di codice — nessuna modifica possibile da parte mia senza eseguire tu stesso un pagamento di prova. Resta da fare quando hai le chiavi live/sandbox pronte.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CL-09",
    epic: "cliente",
    area: "cliente_ordine",
    titolo: "Ingredienti suggeriti coerenti con la pizza (modifica)",
    contesto:
      "In Modifica pizza (foto 6 Capricciosa) compaiono gamberetti/rucola poco coerenti; meglio olive, capperi, salamino piccante.",
    richiesta:
      "Suggerire ingredienti più associati alla pizza in modifica (affinità per categoria/ricetta), non una lista generica.",
    comeVerificare: [
      "Capricciosa: tra i suggeriti capperi/olive/salamino (non gamberetti in prima fila)",
      "Si può comunque cercare qualsiasi ingrediente",
    ],
    noteTraccia:
      "2026-08-07 Foto 6: ingredienti suggeriti per affinità ricetta (sortIngredientsByPizzaAffinity). Capricciosa: olive/capperi/salamino prima di gamberetti.\n" +
      "2026-08-21/22: titolare non ha ancora riverificato il risultato in giro demo — nessuna azione di codice, resta da testare.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-10",
    epic: "cliente",
    area: "cliente_ordine",
    titolo: "Checkout cliente: conferma e conclusione ordine",
    contesto:
      "Il cliente che crea l’ordine non riesce a confermarlo/concluderlo (foto 6). Warning React border/borderColor in ModificaPizzaModal.",
    richiesta:
      "Flusso Aggiungi → Completa ordine → checkout fino a conferma senza blocco. Eliminare warning border shorthand.",
    comeVerificare: [
      "Cliente aggiunge pizza modificata → Completa ordine → conferma senza errore",
      "Console senza warning borderColor vs border su ModificaPizzaModal",
    ],
    noteTraccia:
      "2026-08-07 Foto 6: checkout — Conferma non più silenziosamente disabilitata; Enter isolato su Stripe; finalize soft se webhook lento. borderColor già fix.\n" +
      "2026-08-21/22: Foto 3 (schermata conferma ordine) confermata OK dal titolare — l'area di consegna/verifica indirizzo profilo era già presente e funzionante come da richiesta. Nessuna azione di codice per questo giro.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-13",
    epic: "cassa",
    area: "cassa_ricevuta",
    titolo: "Sconto cassa evidenziato sulla ricevuta di cortesia",
    contesto:
      "Con sconto da cassa, sulla ricevuta lo sconto finiva solo nelle Note come [Sconto cassa €0.20] (foto 8), non come riga chiara.",
    richiesta:
      "Riga dedicata «Sconto cassa − € X» sulla ricevuta; le note restano pulite.",
    comeVerificare: [
      "Ordine con sconto cassa → stampa cortesia",
      "Vedi riga Sconto cassa, totale già scontato",
    ],
    noteTraccia:
      "2026-08-07 Foto 8: se eseguo uno sconto dalla cassa voglio che venga segnato nella ricevuta di cortesia.\n" +
      "2026-08-22: verificato via lettura codice — printRicevuta.js ha già un blocco dedicato <div class=\"sconto\">Sconto cassa − € X</div>, renderizzato solo se scontoEuro > 0, separato dalle note. Sembra già implementato, da riconfermare con una stampa reale prima di chiudere.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-14",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Planning consegne: tabella chiara + pony anche senza carico",
    contesto:
      "Situazione planning (foto 9) troppo dispersiva; serve tabella come screen precedente. Spostando A/2 sotto si assegna ad altro ragazzo; con 2 pony del giorno mostrarli entrambi anche a carico zero.",
    richiesta:
      "Layout tabella compatto; ↑↓ riassegna tra pony presenti; elenco pony del giorno sempre visibile con carico relativo.",
    comeVerificare: [
      "Con 2 pony configurati oggi: entrambi in planning anche se uno ha 0 consegne",
      "Seleziona consegna A/2 → ↓ → passa all’altro pony",
      "Layout leggibile tipo tabella",
    ],
    noteTraccia:
      "2026-08-07 Foto 9: troppo dispersivo; tabella; ↑↓ tra pony; strip carico + righe pony a 0 in ogni fascia.\n" +
      "2026-08-22: confermato dal vivo in Cassa durante il backtest — CassaPlanningBoard.jsx mostra già tabella compatta (colonne Orario/Consegne-ritiri/Forno), tab Pony A/B con conteggio consegne, e Pony B compariva visibile anche con «0 consegne». Sembra già risolto; manca solo riconfermare il riassegno ↑↓ tra pony.",
    urgenza: "alta",
    prontoDaProvare: true,
  },

  // ── Sicurezza ──
  {
    codice: "SE-01",
    epic: "sicurezza",
    area: "sec_isolamento",
    titolo: "Super Admin in supporto vede solo il locale scelto",
    contesto: "In assistenza non si leggono dati di un altro locale per errore.",
    richiesta: "Presenza/supporto legato all’identità e al locale selezionato.",
    comeVerificare: [
      "Demo sul locale A: non compaiono dati di un altro locale",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "SE-02",
    epic: "sicurezza",
    area: "sec_isolamento",
    titolo: "Operazioni sensibili solo da utenti autenticati",
    contesto: "Creare ordini o controllare capacità oltre la vetrina pubblica richiede login.",
    richiesta: "Operazioni riservate per utenti loggati (cliente o staff).",
    comeVerificare: [
      "Flusso ordine da cliente loggato ok",
    ],
    urgenza: "alta",
    prontoDaProvare: true,
  },
])

export function getEpicMeta(epicId) {
  return CHECKLIST_EPIC_LABELS.find((e) => e.id === epicId) || { id: epicId, titolo: epicId, ordine: 99 }
}

export function getAreaMeta(areaId) {
  return (
    CHECKLIST_AREA_LABELS.find((a) => a.id === areaId) || {
      id: areaId,
      epic: null,
      titolo: areaId,
      ordine: 99,
    }
  )
}

/**
 * Gruppo: epic → aree → voci (ogni voce ha il proprio flag).
 * @param {readonly ModificaMeseItem[]} [items]
 */
export function groupChecklistByEpicAndArea(items = CHECKLIST_MODIFICHE_MESE) {
  const epicOrder = [...CHECKLIST_EPIC_LABELS].sort((a, b) => a.ordine - b.ordine)
  const areaById = new Map(CHECKLIST_AREA_LABELS.map((a) => [a.id, a]))

  /** @type {Map<string, { epic: object, areas: Map<string, { area: object, items: ModificaMeseItem[] }> }>} */
  const byEpic = new Map()
  for (const epic of epicOrder) {
    byEpic.set(epic.id, { epic, areas: new Map() })
  }

  for (const item of items) {
    if (!byEpic.has(item.epic)) {
      byEpic.set(item.epic, { epic: getEpicMeta(item.epic), areas: new Map() })
    }
    const bucket = byEpic.get(item.epic)
    const areaMeta = areaById.get(item.area) || getAreaMeta(item.area)
    if (!bucket.areas.has(item.area)) {
      bucket.areas.set(item.area, { area: areaMeta, items: [] })
    }
    bucket.areas.get(item.area).items.push(item)
  }

  return [...byEpic.values()]
    .map(({ epic, areas }) => ({
      epic,
      areas: [...areas.values()].sort((a, b) => (a.area.ordine ?? 99) - (b.area.ordine ?? 99)),
    }))
    .filter((g) => g.areas.some((a) => a.items.length > 0))
}

/** @deprecated usare groupChecklistByEpicAndArea */
export function groupChecklistByEpic(items = CHECKLIST_MODIFICHE_MESE) {
  return groupChecklistByEpicAndArea(items).map(({ epic, areas }) => ({
    epic,
    items: areas.flatMap((a) => a.items),
  }))
}

export function findChecklistByCodice(codice) {
  const c = String(codice || "").trim().toUpperCase()
  return CHECKLIST_MODIFICHE_MESE.find((i) => i.codice === c) || null
}
