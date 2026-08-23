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
  { id: "cassa_carrelli_sospesi", epic: "cassa", titolo: "Ricerca cliente e carrelli in sospeso", ordine: 9 },

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
      "2026-08-21/22: su «cliente test» (demo) il richiamo ordine non riusciva; da Cassa su un altro cliente funziona ma poco chiaro. L'elenco Cassa (Storico ordini) mostra già numero+totale+data per riga, cliccabile per il dettaglio prodotti (non un ID nudo) — probabilmente non notato durante il test. Richiesta aggiuntiva: un menu a tendina/espandibile per aprire più rapidamente senza il giro lista→dettaglio→«Torna all'elenco». Non ancora implementato: serve conferma se si vuole questo redesign (rischio di toccare un flusso cassa già in uso) prima di procedere.\n" +
      "2026-08-22: causa del \"non riusciva\" chiarita — Cliente Test in demo non aveva nessun ordine CONCLUSO da richiamare (solo un ordine rimasto IN_PREPARAZIONE, #47). Aggiunto un ordine demo CONSEGNATO (#50, Capricciosa + Coca Cola, €10.80) collegato a Cliente Test per poter testare subito Aggiungi/Ripeti. Confermato il redesign: Storico ordini in Cassa ora si apre a tendina inline (clic su un ordine espande il dettaglio subito sotto, riclic richiude), niente più giro lista→dettaglio→«Torna all'elenco»; il dettaglio resta in cache per id (riaprire lo stesso ordine non rifà la fetch). Lint pulito, 102 test unitari esistenti passano invariati.\n" +
      "2026-08-22 (limitato a 3): l'elenco «Storico ordini» in Cassa mostrava fino a 400 ordini del cliente — troppi per uno storico rapido. Ora mostra solo gli ultimi 3 (i più recenti per data), tolto anche il CAP dalla riga «Indirizzo» nel dettaglio.",
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
      "Vai in Admin → Parametri, scegli «Manuale» e salva",
      "Fai un ordine dal sito: in cassa deve comparire come «da accettare»",
      "Prova i tre tasti: Accetta, Sposta, Rifiuta",
    ],
    noteTraccia: "2026-08-22: confermato dal titolare, funziona correttamente dal lato cassa.",
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
    noteTraccia:
      "2026-08-23 (verifica su richiesta \"controlla la checklist... verifica\"): confermato non ancora fatto — buildPublicCheckoutDeliverySlots()/filterSlotsExcludingFull() (checkout pubblico) guardano solo la capacità forno (pizze_ogni_15_min), nessun controllo su quanti pony sono disponibili quel giorno (pony_lun_gio/pony_ven_dom) né su quante consegne sono già assegnate alla fascia. Non l'ho implementato: serve prima decidere quante consegne un pony riesce a fare in una fascia da 15 minuti (non esiste oggi un parametro per questo — consegne_ogni_min è più uno spaziatore che una capacità), altrimenti rischio di bloccare/sbloccare le fasce con un numero indovinato a caso.\n" +
      "Trovato però un bug reale collegato mentre verificavo: la RPC vetrina_slot_carico_oggi (usata dal checkout pubblico per sapere quanto è \"pieno\" il forno di una fascia) sommava la quantità di TUTTE le righe ordine — pizze, fritti, dolci, bibite insieme — non solo le pizze. Stessa causa del bug CA-02 (categorie pizza come \"Classiche\"/\"Speciali\" senza la parola pizza nel nome), ma qui lato server e sul checkout pubblico invece che sul planning interno. Corretto (modulo SQL 70): stesso criterio a esclusione già usato per CA-02, applicato qui in SQL. Questo NON risolve OW-04 (resta il tema pony), ma corregge un conteggio forno sbagliato che il cliente vedeva davvero.",
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
      "Apri Cassa → Planning: vedi le fasce orarie",
      "Con 2 pony configurati: vedi le consegne divise A/… e B/…",
      "Sposta una consegna da un pony all'altro e salva: compare il segno ✎",
    ],
    noteTraccia:
      "2026-08-22: confermato dal titolare — funziona, ma il layout non piace. Non ho dettagli su cosa cambiare: da chiarire (colori? disposizione righe/colonne? dimensioni?) prima di ridisegnarlo.",
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
    noteTraccia:
      "2026-08-22: bug reale confermato e corretto — getRigheAggregateByOrdineIds() (adminService.js), la funzione che calcola \"pizze per ordine\" usata ovunque nel planning/capacità forno (Cassa, Bancone, Pizzaiolo), sommava TUTTE le righe dell'ordine (pizze, fritti, dolci, bibite insieme), non solo le pizze. Corretto: ora filtra per categoria prodotto = \"pizze\" (stessa classificazione già usata nel report vendite), passando il tenantId come nuovo secondo parametro — aggiornati tutti e 3 i punti che la chiamano (Cassa, Bancone, Pizzaiolo). Lint pulito, 102 test invariati.\n" +
      "2026-08-22 (regressione trovata dall'utente in diretta, ordine #59 \"Capricciosa/Marinara/Margherita/Patatosa\" mostrato a 0/12 in planning nonostante fossero tutte pizze): il filtro per categoria introdotto sopra funzionava \"a inclusione\" — contava una riga come pizza solo se il nome/slug della categoria conteneva letteralmente la parola \"pizza\". Ma in questo locale (e probabilmente in molti altri) le pizze sono divise in sottocategorie come \"Classiche\", \"Speciali\", \"Bianche\", \"Chiuse\" — nessuna contiene la parola \"pizza\", quindi finivano tutte scartate e il forno risultava sempre vuoto. Corretto passando a un criterio \"a esclusione\" (categoriaEsclusaDalForno in adminService.js): conta come pizza tutto TRANNE le categorie chiaramente non da forno (fritti/dolci/bibite/ingredienti sfusi) — molto più robusto perché non richiede che le sottocategorie pizza si chiamino in un modo specifico. Non ho toccato macroCategoriaVenditaFromCat() (usata anche dai report vendite) per non rischiare di cambiare numeri altrove senza che fosse stato chiesto — il nuovo criterio è isolato al solo conteggio forno. Lint pulito, 102 test invariati.",
    urgenza: "alta",
    prontoDaProvare: true,
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
    noteTraccia:
      "2026-08-23 (verifica su richiesta \"controlla la checklist... verifica\"): non ancora fatto, e più delicato di quanto sembri. Il segno ✎ in Cassa (\"Pony A/B\", CassaPlanningBoard.jsx) viene da un override salvato SOLO in localStorage del browser (planningPonyAssign.js, loadPonyOverrides/savePonyOverrides — coerente con docs/PROGRAMMA_AFFIDABILITA.md, che elenca proprio questo tipo di dato \"workflow\" tra quelli da migrare fuori da localStorage in una fase futura, non ancora fatta). Se Cassa e Delivery girano su due dispositivi diversi (il caso normale in un locale vero), il secondo dispositivo non può proprio vedere l'override del primo: non è un pezzo di UI mancante, è un dato che oggi non esce dal browser che l'ha creato. In più, DeliveryDashboard.jsx (la vista Delivery/Pony reale) non ha alcun concetto di \"Pony A/B\" — assegna ordini a rider veri tramite rider_id (core.rider), un sistema completamente diverso dalle lettere di bilanciamento carico usate in Cassa. Per fare questa richiesta per davvero serve prima una scelta di prodotto: la lettera pony diventa un campo reale sull'ordine (richiede una colonna DB + RPC, sostituendo il localStorage) e/o si collega alle lettere Pony al vero rider_id? Non ho voluto indovinare e implementare qualcosa a metà che sembra funzionare solo nella stessa scheda del browser.",
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
      "Da desktop apri Planning in Cassa: le colonne Ordini e Carrello spariscono",
      "Chiudi Planning: Ordini e Carrello tornano visibili",
    ],
    noteTraccia: "2026-08-22: da riverificare — nessuna modifica di codice in questa sessione.",
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
    noteTraccia:
      "2026-08-23 (verifica su richiesta \"controlla la checklist... verifica\"): ri-eseguito npm audit sulle dipendenze di produzione — stato invariato rispetto a docs/PROGRAMMA_AFFIDABILITA.md: restano le stesse 2 vulnerabilità moderate su react-router (CVE-2025-68470 bypass su <Link>/useNavigate, arbitrary constructor injection su deserializeErrors SSR). Non risolvibili con \"npm audit fix\" perché il fix richiede React Router v7 (major, breaking change rispetto alla v6.30.3 in uso) — già segnato nel documento come migrazione pianificata, non un oversight. Non ho avviato la migrazione v7 in questa sessione: tocca il routing di tutta l'app, troppo rischioso da fare senza una finestra dedicata e test mirati. \"Test isolamento in CI\" resta com'era, nessun progresso da segnalare.",
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
      "2026-08-21/22: rinomina/routing corretti (pulsante DEMO → /operative/dashboard funziona), ma segnalata lentezza: da Delivery, clic DEMO tornava alla pagina giusta ma con un reload completo della pagina (window.location.assign) invece di una navigazione client-side. Fix: ora usa navigate() di react-router. Verificato live: cambio pagina istantaneo, nessun reload del bundle.\n" +
      "2026-08-22: stesso problema trovato nel tasto «Super Admin» dell'header Area cliente demo (ClienteHeaderAccount.jsx, backToSa()) — reload completo via window.location.replace, e segnalato che a volte finiva su Sala QA invece che sulla schermata «Aree di lavoro / Demo live». Primo tentativo: sostituito con navigate() come per DM-04 — ma qui la sessione CAMBIA identità (Cliente Test → Super Admin via supabase.auth.setSession), e navigate() è client-side: AuthContext aggiorna ruolo/utente in modo asincrono (onAuthStateChange), così le guardie di /operative/dashboard vedevano ancora il ruolo cliente per un istante e rimandavano indietro in Area cliente col tasto Demo disabilitato. Corretto: tornato al reload completo (qui è corretto, perché rilegge la sessione da storage già aggiornata) MA rimosso il flag _qa_console dall'URL di destinazione — è quello che faceva reinterpretare il redirect come «torna a Sala QA» in Login.jsx durante il reload. _demo_giro=1 (rimasto) basta a far riconoscere l'hub come «Demo live».\n" +
      "2026-08-22 (segnalati 9 secondi da Area cliente demo a Demo live — TROPPI): il reload completo resta necessario per il motivo sopra (cambio identità), ma prima di innescarlo backToSa() faceva ANCHE un giro supabase.auth.getSession() solo per verificare che la sessione fosse quella giusta — con più tab/sessioni aperte in contemporanea (tipico qui: Super Admin + Cliente Test), getSession() può restare bloccato per secondi sul lock interno di supabase-js (navigator.locks), esattamente il motivo per cui demoClienteSession.js usa già altrove una lettura sincrona diretta da localStorage invece di getSession(). Sostituito anche qui con quella lettura sincrona (readCachedSupabaseUser) — stessa verifica, senza il giro di rete potenzialmente lento. Da verificare dal vivo quanto migliora: il resto dei 9 secondi è quasi certamente il reload completo stesso, che in sviluppo (server Vite locale) è strutturalmente più lento che in produzione — Vite in dev serve centinaia di moduli non impacchettati uno per uno a ogni reload completo, mentre una build di produzione è un bundle unico minificato. Per misurare la latenza «vera» (quella che avranno gli utenti reali) bisognerebbe provare su una build di produzione (npm run build + npm run preview), non sul server di sviluppo.",
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
      "2026-08-21/22: titolare non ha ancora riverificato il risultato in giro demo — nessuna azione di codice, resta da testare.\n" +
      "2026-08-22: riverificato su «Prosciutto e Funghi» — segnalato che i suggerimenti non sembravano coerenti con gli ingredienti della ricetta. Primo tentativo: punteggio extra a un candidato che condivide una PAROLA con un ingrediente in ricetta o col nome della pizza — risultato sbagliato, segnalato subito dal titolare: \"Prosciutto crudo\" saliva in cima solo perché condivide la parola \"prosciutto\" con \"Prosciutto cotto\" già in ricetta, ma i due non sono affatto un abbinamento sensato (sono quasi lo stesso ingrediente, non un complemento). Condividere una parola non vuol dire essere un buon abbinamento culinario: annullato il tentativo, tornato esattamente al comportamento precedente (gruppi fissi + casi speciali Capricciosa/Diavola/mare, nessun bonus per parole condivise). Una vera logica di abbinamento (es. funghi→formaggi stagionati, salumi cotti→verdure, non salumi→salumi simili) richiederebbe una tabella di abbinamenti curata a mano, non deducibile dal testo dei nomi — da fare se vuoi che la costruisca.",
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

  // ── Sessione 2026-08-22 (ultimi sviluppi) ──
  {
    codice: "CA-15",
    epic: "cassa",
    area: "cassa_carrelli_sospesi",
    titolo: "X su cliente selezionato: reset pulito + carrelli in sospeso recuperabili",
    contesto:
      "Foto 1/2: con un cliente selezionato e ordine in corso, la X a destra del nome non riporta alla schermata pulita (foto 2, «Cerca cliente...» + carrello vuoto). Inoltre un carrello iniziato ma non confermato (da casa o da cassa) va perso se il cliente richiama il negozio.",
    richiesta:
      "1) La X accanto al nome cliente selezionato azzera visivamente la schermata cassa come nella foto 2 (nessun cliente, carrello vuoto). 2) Ordini/carrelli aperti e non conclusi (sia dal sito cliente sia da cassa) restano in memoria collegati al cliente: se cassa cerca e seleziona quel cliente, ritrova il carrello in sospeso. 3) Un ordine in sospeso da più di 5 giorni viene eliminato automaticamente.",
    comeVerificare: [
      "Seleziona un cliente, aggiungi articoli, clicca la X → torna alla schermata pulita (nessun cliente, carrello vuoto)",
      "Cliente inizia un ordine online (delivery) senza confermarlo, poi chiama il negozio → cassa cerca/seleziona il cliente e vede lo stesso carrello",
      "Un carrello in sospeso più vecchio di 5 giorni non compare più (eliminato)",
    ],
    noteTraccia:
      "2026-08-22 (verbatim): \"se seleziono un cliente e prendo il suo ordine e poi clicco la x a dx del nome voglio che mi riporti alla pagina della foto 2 cancellando visivamente la schermata e voglio vedere come in foto 2 inoltre per ordini sia aperti e non conclusi da casa o in dal pc cassa voglio che lasci in memoria l'ordine in sospeso. nel senso se un cliente a domicilio inserisce un'ordine ma non lo conferma e mi chiama in negozio io se cerco quel cliente e lo seleziono devo vedere il suo carrello. se un'ordine resta in sospeso per più di 5 giorni elimina.\"\n" +
      "2026-08-22: parte 1 (X → schermata pulita) implementata — mancava setShowRiepilogo(false) nel tasto X, per cui restava sul riepilogo/checkout invece di tornare al menù. Parte 2/3 (carrello in sospeso persistito + eliminazione dopo 5 giorni): scelto con l'utente — nuova tabella dedicata core.carrelli_sospesi (non lo stato ordini esistente), salvataggio solo quando si esce dal carrello (non ad ogni modifica). Implementato: modulo SQL 58 (tabella + RPC upsert/get/delete, applicato su Supabase; pulizia >5gg lazy ad ogni lettura, nessun cron necessario), lato Cassa completo (il tasto X salva la bozza sul DB, selezionare un cliente la ritrova).\n" +
      "2026-08-22 (completato lato sito cliente): PublicCartContext.jsx ora salva il carrello sul DB (origine \"web\") quando il cliente loggato lascia la pagina/cambia tab (visibilitychange/pagehide) — non ad ogni modifica, come deciso. clearCart() (ordine confermato o svuotamento manuale) elimina subito la bozza. Il recupero resta solo lato Cassa (il cliente ha già il proprio carrello persistito localmente); manca solo un'eventuale UI per il cliente stesso di \"riprendi carrello abbandonato\", non richiesta finora. Lint pulito, 102 test invariati.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CA-16",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Sposta orario: dropdown fasce con capacità forno",
    contesto:
      "Il campo «Orario ritiro o consegna» nella modifica ordine era testo libero: non mostrava se la fascia scelta era già al limite del forno.",
    richiesta:
      "Sostituire il campo libero con una tendina di fasce da 15 minuti (\"HH:MM (X/Y pizze)\"), segnalando in arancione le fasce già al limite (restando comunque forzabili da cassa).",
    comeVerificare: [
      "Apri «Modifica ordine» → il campo orario è una tendina con le fasce della giornata",
      "Una fascia già piena mostra «— al limite» e un avviso arancione, ma resta selezionabile",
    ],
    noteTraccia:
      "2026-08-22: implementato in useCassaModificaOrdine.js (nuovo calcolo orarioSlots riusando slotCapacityUtils/planningUtils) e CassaModificaOrdineModal.jsx (select al posto dell'input libero, fallback su testo libero se non ci sono orari di apertura configurati). Lint pulito.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-17",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Mappa geolocalizzazione consegne durante la presa ordine telefonico",
    contesto:
      "Al telefono, per un ordine a domicilio, cassa non vedeva a colpo d'occhio dove fossero già le altre consegne di oggi rispetto al cliente in corso.",
    richiesta:
      "Mappa con pin verde per il cliente in corso e pin rossi per le altre consegne di oggi già prese (con orario a fianco), per capire subito se la zona è già coperta.",
    comeVerificare: [
      "In Cassa, ordine a domicilio → riepilogo mostra la mappa con il pin verde sull'indirizzo digitato",
      "Le altre consegne di oggi con coordinate compaiono come pin rossi con orario",
    ],
    noteTraccia:
      "2026-08-22: implementato — nuovo componente CassaConsegnaMappaSlot.jsx (Leaflet/OpenStreetMap, coerente con la mappa indirizzo cliente già in uso), geocodifica live dell'indirizzo in CassaPage.jsx, coordinate altre consegne da consegna_lat/consegna_lng già in Ordine.\n" +
      "2026-08-22 (verificato dal vivo): la mappa era troppo ingombrante sopra al carrello (layout peggiorato) e senza modo di chiuderla. Corretto: mappa chiusa di default (torna il layout compatto di prima), tasto «📍 Mostra/Nascondi mappa» spostato sopra la sezione «Fasce orarie» (non più accanto all'indirizzo in alto). Aggiunta anche la lista delle vie delle consegne dentro ogni casella oraria (non solo il conteggio) — richiesto per leggere a colpo d'occhio dove sono le consegne già prese in quella fascia, coerente con CA-16/pin sulla mappa.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-18",
    epic: "cassa",
    area: "cassa_stampa",
    titolo: "Stampa comanda/ricevuta automatica di default alla conferma",
    contesto:
      "Per i tenant senza una configurazione esplicita, la stampa restava «manuale» (un tasto in più da premere ad ogni ordine confermato).",
    richiesta: "Di default la stampa parte subito alla conferma dell'ordine, senza tasto aggiuntivo.",
    comeVerificare: [
      "Tenant senza impostazioni di stampa personalizzate → conferma ordine → comanda/ricevuta si stampano subito",
      "Tenant con impostazioni esplicite già configurate → comportamento invariato",
    ],
    noteTraccia:
      "2026-08-22: cambiato il default finale in readStampaQuando() (stampaOperativaConfig.js) da \"manuale\" ad \"auto\", rispettando comunque ogni valore esplicito (nuovo o legacy) già configurato. I 3 test unitari esistenti passano invariati.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-11",
    epic: "cliente",
    area: "cliente_storico",
    titolo: "Ordine cliente: orario modificato da cassa mostrava «Invalid Date»",
    contesto:
      "Quando cassa modificava l'orario di ritiro/consegna di un ordine, la pagina «I miei ordini» del cliente mostrava «Invalid Date» al posto dell'orario.",
    richiesta: "L'orario impostato da cassa deve comparire correttamente sulla pagina ordini del cliente.",
    comeVerificare: [
      "Cassa modifica l'orario di un ordine → il cliente vede l'orario corretto (non «Invalid Date») nei suoi ordini",
    ],
    noteTraccia:
      "2026-08-22: corretto formatDateTime() in ClienteOrdiniPage.jsx — riconosce un orario semplice \"HH:MM\" e lo mostra così com'è invece di passarlo a new Date().toLocaleString() (che falliva su un orario senza data). Aggiunto anche un fallback se la data risultasse comunque non valida.\n" +
      "2026-08-22 (segnalazione correlata): utente ha riportato \"Accetta\" in Cassa bloccato su un ordine web con errore Postgres \"RAISE option already specified: MESSAGE\" (ordine #56, poi #57). Causa reale: public.staff_accetta_ordine_web (RPC accettazione ordine web) aveva una RAISE EXCEPTION con messaggio specificato due volte (stringa di formato + USING MESSAGE), sintassi non ammessa da Postgres — bloccava l'accettazione di QUALSIASI ordine web con pagamento online non ancora concluso. Corretto (modulo SQL 64): un solo messaggio nella RAISE. Verificato poi che il blocco applicativo sottostante è corretto (un ordine con pagamento online mai completato, es. Stripe rimasto in \"requires_payment_method\", non deve entrare in cucina) ma il messaggio non indicava la via di sblocco già esistente in Cassa (\"Segna come pagato\" → Contanti/Carta aggiorna tipo_pagamento e rimuove il blocco) — testo del messaggio chiarito di conseguenza (modulo SQL 65), nessun cambio di logica.\n" +
      "2026-08-22 (automatismo richiesto dall'utente): se un ordine web resta con pagamento online non confermato fino a 20 minuti (o meno) dall'orario di ritiro/consegna previsto, CassaPage.jsx lo converte da sola in \"da pagare alla consegna\" (stesso effetto di \"Segna come pagato\" → Contanti, tipo_pagamento aggiornato), così l'operatore può comunque accettarlo in tempo senza doverci pensare — verifica ogni 30s (stesso tick già usato per gli avvisi di ritardo consegna). Non si applica agli ordini senza orario programmato (ASAP): quelli restano visibili subito nei toast \"da accettare\" e vanno gestiti a mano.\n" +
      "2026-08-22 (rifinitura su richiesta): 1) verificato che quando il pagamento online va a buon fine il webhook segna già da solo tipo_pagamento = \"Carta (Stripe/SumUp — pagato)\" (edge_stripe_mark_payment_succeeded / edge_sumup_mark_payment_succeeded, es. ordine #58) — nessuna modifica necessaria, già funzionante. 2) se invece il provider segnala un fallimento esplicito (online_payment.status = payment_failed/failed/canceled/expired — es. carta rifiutata), la conversione automatica a \"da pagare\" scatta subito, senza aspettare i 20 minuti. 3) nel dettaglio ordine di Cassa, il rigo \"Pagamento\" ora distingue chiaramente un pagamento online Stripe/SumUp ancora in corso (\"🌐 Pagamento online in corso\", teal) o fallito (\"⚠️ Pagamento online non riuscito\", rosso) da un generico \"⏳ Da pagare\" — prima erano indistinguibili a colpo d'occhio.\n" +
      "2026-08-22 (richiesta esplicita dell'utente — cambio di comportamento): rimosso del tutto il blocco su \"Accetta\" per pagamento online non concluso (modulo SQL 66) — l'operatore ora può sempre accettare l'ordine in cucina, anche col pagamento ancora pendente; il mancato incasso resta comunque coperto dall'auto-conversione a \"da pagare\", che ora si applica anche dopo l'accettazione (prima si fermava non appena l'ordine usciva dallo stato \"da accettare\", lasciandolo segnato online per sempre se il pagamento falliva dopo l'Accetta).",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-08",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Bancone: preparazioni Cucina visibili e barrabili come promemoria",
    contesto:
      "Con il tablet Cucina attivo, Bancone non mostrava i prodotti che Cucina doveva ancora preparare — il banconista non li vedeva arrivare. Dopo la prima versione (sola lettura), il titolare ha chiesto di poterli comunque toccare per barrarli come promemoria personale, senza dimenticare nulla — inoltre alla \"Consegnato\" (ritiro) o \"Pronto\" (consegna) i chip dell'ordine devono sparire subito dal pannello.",
    richiesta:
      "Quando la Cucina è attiva, Bancone mostra i prodotti/ingredienti che Cucina sta preparando: cliccabili per barrarli come promemoria locale (non scrive lo stato condiviso, resta solo la Cucina a segnarli davvero pronti). Le bibite restano interattive come sempre. Alla \"Consegnato\" (ritiro) rimuovi subito i chip dell'ordine; alla \"Pronto\" per le consegne, rimuovili comunque anche se qualche bibita non risulta ancora barrata.",
    comeVerificare: [
      "Tenant con Cucina attiva → chip di preparazione Cucina in Bancone cliccabili, si barrano al tocco",
      "Segna un ritiro come Consegnato → i suoi chip spariscono subito dal pannello",
      "Un ordine a domicilio passa a Pronto → i suoi chip spariscono subito, anche con bibite non barrate",
    ],
    noteTraccia:
      "2026-08-22: prima versione — implementato in Bancone.jsx (flag readOnlyPrep quando cucinaTabletOn, chip non cliccabili) — verificato dal vivo con screenshot condiviso in chat.\n" +
      "2026-08-22 (revisione): il titolare ha chiesto di renderli cliccabili anche con Cucina attiva. Corretto: i chip Cucina in Bancone si possono ora barrare (pickedBanconeKeys, stesso meccanismo locale delle bibite — non tocca cucina_prep_stato, quindi non finge che Bancone abbia preparato il task). markAsConsegnato ora rimuove subito l'ordine anche dall'aggregazione «da preparare» (prima restava fino al refresh successivo). Le consegne PRONTO vengono escluse dall'aggregazione appena raggiungono quello stato (prima restavano finché tutte le bibite non erano barrate) — confermato esplicitamente dal titolare, accettando che una bibita non ancora presa non blocchi più la sparizione dell'ordine.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-09",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Cucina/Bancone: ingredienti «in linea» segnalati per errore come da preparare",
    contesto:
      "Capperi, olive e salamino aggiunti come extra su una pizza comparivano nei task «da preparare» di Cucina/Bancone, pur essendo ingredienti normali che il pizzaiolo gestisce da sé in cottura (nessuna categoria/flag prep_cucina impostata).",
    richiesta:
      "Un'aggiunta va segnalata come task di preparazione solo se ha davvero un flag prep_cucina o una categoria impostata (congelato/affettato/bibita/fritto/dolce) — non ogni «aggiunta» genericamente.",
    comeVerificare: [
      "Pizza con capperi/olive/salamino aggiunti (senza categoria prep impostata) → non compaiono nei task da preparare",
      "Un'aggiunta con categoria impostata (es. surgelato) continua a comparire come prima",
    ],
    noteTraccia:
      "2026-08-22: corretto in cucinaPrepTasks.js (buildCucinaPrepTasks) e banconeSlotPick.js (aggregateBanconeIngredientsBySlot) — le «aggiunte» ora passano dal controllo ingredientNeedsPrepMonitor() prima di diventare un task; le aggiunte «a fine cottura» restano sempre forzate come prima (per design, vanno messe dopo la cottura indipendentemente dai flag).",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "OP-10",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Test 4 reparti: riquadri personalizzabili",
    contesto:
      "La vista «Test 4 reparti» mostrava sempre Pizzaioli/Bancone/Cucina/Delivery fissi, senza poter scegliere ad esempio Cassa al posto di uno di questi.",
    richiesta: "Ogni riquadro deve avere una tendina per scegliere liberamente quale reparto mostrare (Cassa incluso).",
    comeVerificare: [
      "Apri «Test 4 reparti» → ogni riquadro ha una tendina con tutti i reparti disponibili",
      "Cambiando reparto in un riquadro, la scelta resta anche ricaricando la pagina",
    ],
    noteTraccia:
      "2026-08-22: implementato in RepartiQuadTestPage.jsx — aggiunta Cassa alle opzioni disponibili, tendina per riquadro, selezione salvata in localStorage. Lint pulito.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "OP-11",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Gestione stati ordine non ancora come richiesto",
    contesto:
      "L'utente ha segnalato che la gestione degli stati dell'ordine (IN_ATTESA / IN_PREPARAZIONE / PRONTO / CONSEGNATO / ANNULLATO, e come si riflettono tra i reparti) non è ancora completa come vuole, ripetendo una richiesta già fatta in precedenza — ma senza ridettagliare stavolta cosa manca esattamente.",
    richiesta:
      "Da chiarire con l'utente: quale/i transizione/i di stato non funziona/no come si aspetta, o quale reparto non riflette correttamente lo stato. Non sono ancora note le specifiche esatte per intervenire.",
    comeVerificare: ["Da definire una volta chiarito il comportamento atteso"],
    noteTraccia:
      "2026-08-22: segnalazione registrata su richiesta esplicita (\"appuntati...\") — nessun dettaglio aggiuntivo fornito in questo turno su cosa non va. Nessuna modifica di codice fatta: serve ripartire dal chiedere all'utente quale caso preciso non funziona prima di toccare la gestione stati (tocca troppe pagine — Cassa/Bancone/Cucina/Pizzaiolo/Delivery/Cliente — per indovinare alla cieca).",
    urgenza: "alta",
    prontoDaProvare: false,
  },
  {
    codice: "OP-12",
    epic: "esperienza",
    area: "op_reparti",
    titolo: "Pizzaioli sembrava senza lavoro (quadrante vuoto) mentre gli altri reparti avevano ordini",
    contesto:
      "In \"Test 4 reparti\", con ordini programmati per pranzo/cena delle prossime ore, il riquadro Pizzaioli risultava completamente vuoto (nessun testo, nessun ordine) mentre Cucina/Bancone/Delivery mostravano già gli stessi ordini — sembrava un bug (\"pizzaioli non hanno pizze segnate da fare!!!!!!!!!!!!\").",
    richiesta: "Il pizzaiolo deve vedere chiaramente perché non ha ordini davanti, non una pagina silenziosamente vuota.",
    comeVerificare: [
      "Con ordini in preparazione programmati per oltre 45 minuti da adesso → in cima alla pagina Pizzaioli (anche dentro un riquadro di Test 4 reparti) appare un avviso: \"Ci sono N ordini in preparazione più avanti oggi, nessuno entro i prossimi 45 minuti (il prossimo alle HH:MM)\"",
    ],
    noteTraccia:
      "2026-08-22: non era un bug di caricamento dati — Dashboard.jsx (Pizzaioli) filtra deliberatamente gli ordini mostrati a una finestra di \"prossimi N minuti\" (pizzaiolo_ordini_visibili_minuti, default 45) per non affollare lo schermo con ordini di ore dopo; Cucina/Bancone/Delivery non hanno questo filtro, da cui l'incoerenza vistosa. Aggiunto un avviso esplicito quando ci sono ordini in preparazione ma nessuno entro la finestra, invece del vuoto silenzioso (prima il testo \"Nessun ordine in preparazione\" era addirittura nascosto dentro i riquadri di Test 4 reparti). Scoperto in corso d'opera: pizzaiolo_ordini_visibili_minuti (e altri 2 parametri pizzaiolo_*) sono letti dal codice ma NON hanno alcun campo di modifica in nessuna pagina Impostazioni — restano bloccati al valore di default 45, irraggiungibili dall'admin. Non l'ho toccato in questo intervento (richiede capire prima se vada aggiunto in Parametri operativi o Stampa operativa, dove oggi vivono solo come default morti) — segnalato qui per non dimenticarlo. Lint pulito, 102 test invariati.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "AD-06",
    epic: "admin",
    area: "admin_parametri",
    titolo: "Orari apertura: fascia pranzo separata dalla sera",
    contesto:
      "Un locale aperto sia a pranzo sia a sera non poteva rappresentarlo: la tabella orari aveva una sola coppia apertura/chiusura per giorno.",
    richiesta:
      "Aggiungere per ogni giorno un tag «Aperto anche a pranzo» con orario da/a dedicato, oltre alla fascia principale.",
    comeVerificare: [
      "Impostazioni → Orari: attiva «Aperto anche a pranzo» su un giorno, imposta pranzo 12:00–14:30",
      "In cassa/checkout le fasce orarie di quel giorno includono sia il pranzo sia la sera, saltando il buco pomeridiano",
    ],
    noteTraccia:
      "2026-08-22: aggiunto in OrariSection.jsx (checkbox + orario pranzo per giorno) e reso band-aware il motore fasce in planningUtils.js (getTodayOrari/buildSlotsFullDay) — per i giorni senza pranzo attivo il comportamento resta identico a prima (i 5 test esistenti di planningUtils.test.js passano invariati).",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-19",
    epic: "cassa",
    area: "cassa_paylink",
    titolo: "Pagina di pagamento ospitata + tasto WhatsApp",
    contesto:
      "Il pannello «Paga online» in Cassa non aveva nessun link di pagamento reale da condividere: Stripe creava solo un PaymentIntent usato da un checkout in-pagina, mai un URL per il cliente. Il backlog WhatsApp era bloccato per questo.",
    richiesta:
      "Pagina di pagamento pubblica (senza login) a cui punta il link; tasto WhatsApp nel pannello Paga online con il link precompilato.",
    comeVerificare: [
      "Cassa → ordine con pagamento online (provider Stripe) → «Registra / invia richiesta link» → compare «📱 Invia su WhatsApp»",
      "Apri il link (/paga/:id) su un browser senza login → vedi importo e modulo carta Stripe",
      "Pagamento completato → la pagina mostra «Pagamento ricevuto» e l'ordine passa a pagato",
    ],
    noteTraccia:
      "2026-08-22: nuova rotta pubblica /paga/:intentId (PagamentoLinkPage.jsx, standalone, fuori da PublicLayout — multi-tenant, nessun login). Nuova Edge Function payment-link-checkout (anonima: l'id di payment_link_intents fa da autorizzazione, non un JWT) — crea/riusa il PaymentIntent Stripe solo quando il link viene aperto davvero, non più alla registrazione in cassa (evita PaymentIntent orfani). Modulo SQL 59 (edge_payment_link_intent_get, edge_payment_link_attach_stripe_intent; edge_stripe_mark_payment_succeeded/_failed estese a payment_link_intents). runUnifiedPayByLinkSetup() semplificato — rimossa una chiamata alla Edge Function autenticata che in pratica non funzionava mai per ordini presi a telefono da cassa (richiedeva un abbinamento cliente↔ordine inesistente in quel caso). SumUp resta non collegato. Lint pulito, 102 test invariati. Da testare dal vivo con una chiave Stripe test configurata su un tenant.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-12",
    epic: "cliente",
    area: "cliente_profilo",
    titolo: "Suggerimenti indirizzo: includi il civico digitato",
    contesto:
      "Nel campo indirizzo (profilo/registrazione), digitando \"Via Pontedera 4\" il suggerimento mostrato era \"Via Pontedera\" senza il civico — Nominatim spesso non ha quel civico esatto indicizzato e restituisce solo la via.",
    richiesta: "I suggerimenti devono includere il civico digitato, anche quando Nominatim non lo geocodifica esattamente.",
    comeVerificare: [
      "Digita un indirizzo con civico (es. \"Via Pontedera 4\") → il suggerimento mostra il civico",
      "Cassa → Nuovo cliente → digita una via del tuo paese → i suggerimenti sono solo della tua area di consegna, non di altre città/paesi",
      "Nessun CAP nei suggerimenti né nell'indirizzo salvato; vie ripetute con solo il CAP diverso appaiono una volta sola",
    ],
    noteTraccia:
      "2026-08-22: corretto in ClienteIndirizzoMappaField.jsx — se il risultato Nominatim non ha un house_number reale (address.house_number), il civico digitato dall'utente viene ricomposto nel testo del suggerimento (posizione sulla mappa resta quella della via, corretta per l'uso). Stesso limite individuato anche in formatIndirizzoFromNominatim (usato dal campo indirizzo \"Nuovo cliente\" in Cassa) ma non ancora corretto lì — da fare se serve anche in quel flusso.\n" +
      "2026-08-22 (completato anche in Cassa): formatIndirizzoFromNominatim() accetta ora un secondo parametro opzionale (il testo digitato) con lo stesso fallback civico; NuovoClienteModal.jsx (Cassa → Nuovo cliente) lo passa in entrambi i punti dove formatta l'indirizzo. Lint pulito, i 4 test esistenti di formatIndirizzoItaliano.test.js passano invariati.\n" +
      "2026-08-22 (segnalati risultati fuori zona e CAP confusi): i suggerimenti in Cassa → Nuovo cliente non erano limitati all'area di consegna del locale (potevano tornare vie omonime ovunque nel mondo) e mostravano lo stesso indirizzo ripetuto 4-5 volte con solo il CAP diverso. Corretto: la ricerca ora usa il bounding box dell'area di consegna già configurata (Nominatim bounded=1) + countrycodes=it come rete di sicurezza se l'area non è ancora configurata; il CAP è stato tolto sia dai suggerimenti mostrati sia dall'indirizzo salvato, e le righe che risultano identiche dopo aver tolto il CAP vengono unite (non più ripetute). Stesso taglio del CAP applicato anche alla riga «Indirizzo» nel dettaglio storico ordini di Cassa. Lint pulito, 102 test invariati.\n" +
      "2026-08-22 (civico sparito di nuovo): segnalato che digitando \"Via Giovanni Comino 3, Padova\" il civico \"3\" spariva dal suggerimento. Causa: la ricerca del civico digitato guardava solo l'ULTIMO numero di tutta la stringa — funzionava con \"Via X 4\" ma non appena si digitava anche la città dopo il civico (\"Via X 4, Padova\"), il civico non era più l'ultimo token e veniva ignorato. Corretto in entrambi i punti (formatIndirizzoItaliano.js e ClienteIndirizzoMappaField.jsx): ora cerca solo nel pezzo di testo prima della prima virgola.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "AD-07",
    epic: "admin",
    area: "admin_parametri",
    titolo: "Impostazioni: anteprima comanda sempre visibile, parametri più larghi, account con password",
    contesto:
      "Nella pagina Stampa operativa l'anteprima a destra si perdeva scorrendo la pagina, servendo continui su/giù per confrontare una modifica. In Parametri operativi i campi numerici (pony, pizze, fasce) stavano tutti in una colonna stretta con tanto spazio vuoto a destra. In più, dentro Admin del locale non c'era nessun posto per cambiare la password del proprio account.",
    richiesta:
      "Anteprima comanda che resta visibile mentre scorri la pagina. Campi corti di Parametri operativi affiancati su più colonne invece che impilati. Nuova pagina «Il mio account» con cambio password.",
    comeVerificare: [
      "Admin → Impostazioni → Stampa operativa: scorri la pagina, l'anteprima a destra resta ferma in vista",
      "Admin → Impostazioni → Parametri operativi: i primi 5 campi numerici sono affiancati a due per riga, non più impilati",
      "Admin → Impostazioni → Il mio account: cambia la password del tuo utente",
    ],
    noteTraccia:
      "2026-08-22: implementato — StampaOperativaSection.jsx (colonna anteprima con position:sticky), ParametriSection.jsx (i 5 campi corti in griglia 2 colonne, tolto il limite di larghezza a 420px), nuova pagina AccountSection.jsx (/admin/settings/account, cambio password via supabase.auth.updateUser). Lint pulito, 102 test invariati.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "AD-08",
    epic: "admin",
    area: "admin_parametri",
    titolo: "Listino gestionale adeguato al mercato + promozioni con scadenza",
    contesto:
      "Il listino prezzi del gestionale (catalogo servizi Super Admin) andava adeguato al mercato. Inoltre lo sconto per singolo cliente (già esistente: percentuale + importo fisso) non aveva una scadenza — restava attivo per sempre finché qualcuno non tornava a toglierlo a mano.",
    richiesta:
      "Nuovi prezzi di listino basati su una ricerca dei prezzi tipici dei gestionali cloud per pizzerie/ristoranti in Italia. Data di scadenza per lo sconto di ogni cliente (percentuale e/o fisso, decisi caso per caso): oltre quella data il canone stimato torna al listino pieno senza cancellare i valori impostati.",
    comeVerificare: [
      "Super Admin → Catalogo servizi: i prezzi sono quelli nuovi (es. Ordini a cassa €25, Ordini online €35, Schermate tablet €42)",
      "Super Admin → Clienti → Modifica cliente → scheda Servizi: nuovo campo «Scadenza promozione»",
      "Imposta uno sconto con scadenza passata → il canone stimato mostra «Promozione scaduta» e torna al prezzo pieno",
      "Togli la scadenza (o mettine una futura) → lo sconto torna attivo con gli stessi valori",
    ],
    noteTraccia:
      "2026-08-22: prezzi aggiornati in serviziAppRegistro.js sulla base di una ricerca web sui prezzi di mercato italiani (Cassa in Cloud/TeamSystem, Appresto, RistoManager — pacchetto cloud completo tipicamente €80-150/mese in Italia). Il pacchetto Enterprise completo passa da €153 a €175/mese, proposta approvata dal titolare prima di applicarla.\n" +
      "Promozioni con scadenza: nuova colonna admin.tenants.sconto_scadenza (modulo SQL 60, vista public.tenants aggiornata). Tenants.jsx e TenantServiziPlanFields.jsx aggiornati: data di scadenza condivisa da sconto percentuale e sconto fisso, canone netto e badge in elenco clienti tornano al listino pieno oltre la scadenza (senza azzerare i valori salvati). Lint pulito, 102 test invariati.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "AD-09",
    epic: "admin",
    area: "admin_parametri",
    titolo: "Parametri operativi: capacità/logistica raggruppate a sinistra, accettazione ordini a destra",
    contesto:
      "In Admin → Impostazioni → Parametri operativi, i parametri di capacità/logistica (pony per giorno, velocità pony, capacità forno, tempo per pizza, soglie di ritardo, ecc.) erano sparsi in 3 punti diversi della pagina (una griglia in cima, un blocco \"Consegne / rider\" più in basso, due campi ancora più sotto) mentre l'impostazione \"Accettazione ordini online\" stava in mezzo ad altre impostazioni della vetrina, lontana dagli altri parametri operativi.",
    richiesta:
      "Consolidare tutti i parametri di capacità/logistica in un'unica colonna a sinistra; \"Accettazione ordini online\" (automatica/manuale) in una colonna a destra, affiancata.",
    comeVerificare: [
      "Admin → Impostazioni → Parametri operativi: in cima alla pagina, sotto «Capacità e logistica», colonna sinistra con tutti i parametri numerici di capacità/consegne/forno; colonna destra con «Accettazione ordini online» (Automatica/Manuale)",
      "Salva parametri → tutti i valori restano quelli inseriti (nessun campo perso nello spostamento)",
    ],
    noteTraccia:
      "2026-08-22: unificati in una sola sezione «Capacità e logistica» (griglia a sinistra) i campi prima sparsi: pony_lun_gio, pony_ven_dom, pizze_ogni_15_min (capacità forno), tempo_preparazione_pizza, soglia_giallo_pizze, consegne_ogni_min, ritiro_ogni_min, rider_velocita_media_kmh, rider_velocita_mal_tempo_kmh, rider_ritardo_soglia_min, rider_tempo_fermata_cliente_min, rider_forno_evidenza_min, rider_partenza_buffer_min, ricalcolo automatico. Il fieldset «Accettazione ordini online» (auto/manuale), prima dentro «Ordini web (vetrina)», è stato spostato accanto come colonna destra. Nessun campo rinominato/rimosso nello state o nel salvataggio (setParam/handleSave invariati) — solo riposizionati nel markup, quindi nessun rischio di perdita dati. \"Capienza bauletto\" (citata come esempio dall'utente) NON esiste oggi come parametro globale — è una capacità per-rider verificata dalle RPC di assegnazione (moduli SQL 41/43), non un valore unico del locale: non ne ho creato uno nuovo per non inventare una funzionalità non richiesta esplicitamente. Lint pulito.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "CL-16",
    epic: "cliente",
    area: "cliente_checkout",
    titolo: "Messaggio \"ordini non disponibili\": togliere la parola \"vetrina\"",
    contesto:
      "Il popup mostrato quando gli ordini online sono disattivati diceva \"...non accetta ordini dalla vetrina online...\" — linguaggio interno (\"vetrina\" è il nome tecnico della pagina pubblica), non naturale per un cliente.",
    richiesta: "Togliere la parola «vetrina» dal messaggio.",
    comeVerificare: ["Con ordini online disattivati, apri il menù pubblico → il popup dice \"...non accetta ordini online...\", senza la parola vetrina"],
    noteTraccia:
      "2026-08-22: tolta \"dalla vetrina online\" → \"online\" in entrambe le varianti del messaggio (con e senza nome del locale) in OrdineOnlineDisattivoModal.jsx.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "CL-17",
    epic: "cliente",
    area: "cliente_checkout",
    titolo: "Ordine troppo grande per una fascia: messaggio generico invece di \"contatta il locale\"",
    contesto:
      "Con un carrello che ha più pizze della capacità massima configurata per UNA fascia (es. 17 pizze contro una capacità forno di poche unità a quarto d'ora), l'ordine non entra in nessuna fascia — nemmeno una completamente vuota. Il checkout mostrava comunque il messaggio generico \"Nessuna fascia disponibile (orario di chiusura, giorno chiuso o fasce piene)\", che fa pensare a un problema del locale invece che alla quantità dell'ordine.",
    richiesta: "In quel caso specifico, invitare il cliente a contattare direttamente il locale invece del messaggio generico.",
    comeVerificare: [
      "Carrello con più pizze della capacità massima di una fascia (impostazione \"Pizze ogni 15 minuti\" in Parametri operativi) → il checkout mostra \"Il tuo ordine è troppo grande... contatta direttamente il locale\", non il messaggio generico",
    ],
    noteTraccia:
      "2026-08-22: in PublicOrdineCheckoutPage.jsx aggiunto un controllo separato (cartTroppoGrandePerUnaFascia: pizze nel carrello > capacità massima di una fascia) che sostituisce il messaggio generico con l'invito a contattare il locale, solo quando è quello il motivo per cui non compare nessuna fascia. Rimossa anche, su richiesta, la scritta di conferma \"Indirizzo ok per la consegna.\" (ridondante con \"Consegna assegnata a: ...\" poco sotto). Lint pulito, 102 test passano.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-18",
    epic: "cliente",
    area: "cliente_storico",
    titolo: "Dettaglio ordine cliente mostrava il log interno grezzo invece di un messaggio pulito",
    contesto:
      "Nel dettaglio di un ordine annullato/rifiutato, il campo \"Note\" mostrava il log operativo interno grezzo e concatenato (es. \"Ordine web · consegna · pagamento carta alla consegna · Ordine web · in attesa accettazione cassa · Rifiutato cassa: prova rifiuto\") — gergo interno e il motivo di rifiuto digitato dall'operatore, pensati per uso interno, finivano dritti sotto gli occhi del cliente.",
    richiesta: "Il cliente deve vedere un messaggio chiaro, non il log interno grezzo.",
    comeVerificare: [
      "Cassa rifiuta un ordine web con un motivo → il cliente, aprendo il dettaglio dell'ordine, vede \"Il locale ha annullato l'ordine. Motivo: ...\" invece del testo grezzo con \"Ordine web\", \"in attesa accettazione cassa\" ecc.",
    ],
    noteTraccia:
      "2026-08-22: individuato da uno screenshot del dettaglio ordine cliente (numero #64). Il campo note dell'ordine è di fatto un log interno (tracciamento canale + metodo pagamento + motivo rifiuto in un'unica stringa concatenata con \"·\"), mai pensato per essere letto dal cliente — confermato controllando il checkout pubblico: non esiste un campo note libero scritto dal cliente, quel campo è sempre e solo generato dal sistema/dall'operatore. Aggiunta noteClienteVisibile() in ClienteOrdiniPage.jsx: per un ordine ANNULLATO con motivo di rifiuto estrae un messaggio pulito (\"Il locale ha annullato l'ordine. Motivo: ...\"), altrimenti il campo Note semplicemente non viene mostrato al cliente (i segmenti rimanenti sono tutti tracciamento interno, nessuna informazione persa per lui). Lint pulito, 102 test invariati.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-13",
    epic: "cliente",
    area: "cliente_storico",
    titolo: "Storico ordini cliente: errore \"structure of query...\" + schermata che non si aggiorna",
    contesto:
      "La pagina «Storico ordini» del cliente mostrava l'errore Postgres «structure of query does not match function result type» invece della lista. In più, se cassa accettava/spostava un ordine, il cliente non vedeva cambiare lo stato senza ricaricare la pagina a mano.",
    richiesta: "Storico ordini senza errori; lo stato dell'ordine si aggiorna da solo mentre il cliente ha la pagina aperta.",
    comeVerificare: [
      "Cliente → I miei ordini: nessun errore, la lista si vede",
      "Cassa accetta o modifica un ordine web mentre il cliente ha la pagina/il dettaglio ordine aperti → lo stato si aggiorna entro ~15 secondi da solo",
    ],
    noteTraccia:
      "2026-08-22: causa trovata — la funzione public.cliente_lista_propri_ordini() dichiarava orario_ritiro come timestamp, ma la colonna reale è TEXT (es. \"19:15\", spesso orari modificati a mano da cassa — stesso campo di CL-11). Postgres falliva il cast implicito per qualunque orario non-timestamp valido, cioè quasi sempre. Corretto (modulo SQL 61): la funzione ora dichiara orario_ritiro TEXT, coerente con la colonna reale.\n" +
      "Aggiunto anche un aggiornamento silenzioso della pagina ogni 15 secondi (e subito al ritorno sulla tab): prima la pagina caricava gli ordini una sola volta all'apertura e non si aggiornava mai da sola. Lint pulito, 102 test invariati.",
    urgenza: "alta",
    prontoDaProvare: true,
  },
  {
    codice: "CL-14",
    epic: "cliente",
    area: "cliente_storico",
    titolo: "Ordine aperto oggi in evidenza",
    contesto:
      "Il cliente voleva vedere subito l'ordine (o gli ordini) ancora in corso della giornata, in attesa di consegna/ritiro — non perso in mezzo allo storico generale.",
    richiesta:
      "Sezione dedicata in cima a «I miei ordini» con gli ordini di oggi non ancora consegnati/ritirati né annullati.",
    comeVerificare: [
      "Cliente con un ordine di oggi ancora in corso → in cima a «I miei ordini» vede «Il tuo ordine di oggi» evidenziato",
      "Ordine concluso (consegnato/ritirato) o di un altro giorno → non compare in quella sezione, resta nello storico sotto",
    ],
    noteTraccia:
      "2026-08-22: aggiunta sezione «Il tuo ordine di oggi» (o plurale) in ClienteOrdiniPage.jsx, sopra lo storico generale — filtra gli ordini con data odierna e stato diverso da CONSEGNATO/ANNULLATO. Sfrutta l'aggiornamento automatico ogni 15s già aggiunto per CL-13. Lint pulito, 102 test invariati.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CL-15",
    epic: "cliente",
    area: "cliente_profilo",
    titolo: "Pulsante geolocalizzazione sul campo indirizzo",
    contesto:
      "Richiesta di poter compilare l'indirizzo con un click usando la posizione del dispositivo, con la stessa logica già usata in Admin → Dati Pizzeria (GPS del browser + reverse geocoding Nominatim), invece di doverlo sempre digitare/cercare a mano.",
    richiesta:
      "Pulsante 📍 a destra del campo indirizzo che rileva la posizione del dispositivo e compila l'indirizzo automaticamente.",
    comeVerificare: [
      "Profilo/registrazione cliente → clic su 📍 accanto all'indirizzo → il browser chiede il permesso di posizione → indirizzo e mappa si aggiornano da soli",
      "Cassa → Nuovo cliente → stesso pulsante 📍 disponibile accanto al campo indirizzo",
    ],
    noteTraccia:
      "2026-08-22: estratta la logica GPS+reverse-geocoding già funzionante in DatiPizzeriaSection.jsx in una utility condivisa (geolocateBrowser.js) e aggiunto il pulsante 📍 in ClienteIndirizzoMappaField.jsx (profilo/registrazione cliente) e in NuovoClienteModal.jsx (Cassa → Nuovo cliente). Nota per Cassa: geolocalizza il dispositivo che clicca (utile se il cliente è fisicamente lì, es. tablet al banco), non ha senso per un ordine telefonico normale — l'operatore userà comunque la ricerca testuale in quel caso. Lint pulito.\n" +
      "2026-08-22 (rifinitura su richiesta \"non ancora enterprise\"): (1) il pulsante 📍 non è più sovrapposto dentro il campo indirizzo (rischiava di sembrare in conflitto col testo/civico digitato) — ora è un pulsante separato accanto al campo, stesso trattamento in entrambi i punti. (2) Il civico digitato con sub-unità separata da barra (es. \"19a/1\", usato in alcune città) veniva riconosciuto solo per la parte dopo la barra — regex allargata in formatIndirizzoItaliano.js e nel duplicato locale di ClienteIndirizzoMappaField.jsx. (3) Nel campo indirizzo cliente (profilo/registrazione) i suggerimenti mostravano ancora il CAP finale e la stessa via poteva comparire più volte identica — non era mai stato applicato lì il fix CL-12 fatto solo per Cassa: aggiunto lo stesso strip CAP + deduplica. Lint pulito.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "CA-20",
    epic: "cassa",
    area: "cassa_ricevuta",
    titolo: "Ricevuta di cortesia: testo troppo vicino al bordo",
    contesto: "Nella ricevuta stampata (documento di cortesia) il testo, in particolare prezzi e indirizzo, arrivava quasi a toccare il bordo del foglio.",
    richiesta: "Un margine interno più comodo su tutti i lati della ricevuta stampata.",
    comeVerificare: ["Stampa una ricevuta di cortesia → testo e prezzi non toccano il bordo del foglio"],
    noteTraccia:
      "2026-08-22: in printRicevuta.js il corpo della pagina aveva solo 2px di spazio interno (praticamente nessuno). Portato a 3mm/4mm (alto-basso/sinistra-destra), coerente con la larghezza già impostata per il rotolo termico.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "CA-21",
    epic: "cassa",
    area: "cassa_ordini_web",
    titolo: "Rifiuta ordine web: popup nativo del browser invece del dialogo dell'app",
    contesto:
      "Il tasto \"Rifiuta\" su un ordine web apriva il prompt/confirm nativi del browser (in alto, non centrati, stile diverso da tutto il resto dell'app) invece del dialogo centrato già usato ovunque altrove (es. i messaggi \"Attenzione\").",
    richiesta: "Stesso layout e posizione a centro schermo del dialogo \"Attenzione\" anche per il motivo del rifiuto.",
    comeVerificare: [
      "Cassa → ordine web → Rifiuta → si apre un dialogo centrato in stile app (non il popup nativo del browser) con un campo per il motivo",
    ],
    noteTraccia:
      "2026-08-22: il sistema di dialoghi in-app (appAlert/appConfirm, src/utils/appDialog.js + AppDialogHost.jsx) copriva già alert/confirm ma non prompt. Aggiunto appPrompt() con lo stesso stile/posizione (centrato, stessa card, campo di testo incluso) e sostituito in CassaPage.jsx il window.prompt + window.confirm del rifiuto ordine web con un'unica chiamata appPrompt. Lint pulito.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "CA-22",
    epic: "cassa",
    area: "cassa_clienti",
    titolo: "«Storico ordini» in Cassa smette di trovare un cliente oltre i 400 ordini più recenti",
    contesto:
      "Il tasto \"Storico ordini\" nel pannello cliente carica solo gli ultimi 400 ordini dell'intero locale (getOrders con limit:400, nessun filtro per cliente lato server) e SOLO DOPO filtra in JavaScript quelli che corrispondono al cliente selezionato, tenendo poi gli ultimi 3. Trovato durante uno stress test a tavolino (inseriti 50.000 ordini storici di prova sul tenant demo, poi rimossi): la query stessa resta veloce anche a quel volume (l'indice tenant_id+created_at limita bene), ma un cliente semi-abituale che non ha ordinato tra gli ultimi ~400 ordini del locale risulterebbe SENZA storico anche se ha ordinato davvero in passato — un locale con qualche decina di ordini al giorno ci arriva in una manciata di giorni.",
    richiesta:
      "Lo storico di un cliente dovrebbe essere cercato per quel cliente specifico (es. per telefono, che è quasi sempre univoco), non tra un blocco fisso degli ordini più recenti di tutto il locale.",
    comeVerificare: [
      "Nessun modo semplice per riprodurlo senza generare centinaia di ordini reali: verificato solo a livello di query/codice, non ancora provato dal vivo",
    ],
    noteTraccia:
      "2026-08-22: individuato durante uno stress test generale su richiesta dell'utente (\"stressa in locale il sistema... i punti di fragilità\"). NON ancora corretto: serve decidere se filtrare lato server per telefono/nome (richiede un indice ad hoc, es. su telefono_ritiro) prima di implementare, per non introdurre un'altra query lenta al posto di questa.\n" +
      "2026-08-22 (mitigazione su richiesta \"correggi i bug che hai rilevato\"): il limite è stato alzato da 400 a 3000 ordini (getOrders in CassaPage.jsx, tooltip aggiornato). Non è la ricerca server-side vera descritta sopra — ordiniFiltratiPerClienteAnagrafica() usa un match sfumato (indirizzo + telefono/email \"loose\", o nome esatto) che non è banale da tradurre in una query SQL senza duplicare quella logica in Postgres — ma 3000 copre comodamente mesi di attività di un locale reale, restando comunque un fetch indicizzato veloce (~5ms anche a 50.000 ordini nel test). La ricerca server-side vera resta un miglioramento futuro se l'archivio dovesse comunque superarlo.",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-23",
    epic: "cassa",
    area: "cassa_clienti",
    titolo: "Ricerca cliente in Cassa (Nuovo cliente / fidelity) vede solo gli ultimi 100 clienti in anagrafica",
    contesto:
      "searchAnagraficaClienti() in adminService.js carica solo le 100 righe più recenti di anagrafica_clienti per il tenant (order by created_at desc, limit 100) e filtra il testo digitato lato client su quelle 100 — stesso identico pattern del problema CA-22, ma sull'anagrafica invece che sugli ordini.",
    richiesta:
      "Cercare un cliente per nome/telefono dovrebbe trovarlo ovunque sia in archivio, non solo se è tra gli ultimi 100 inseriti.",
    comeVerificare: [
      "Non ancora riproducibile oggi: l'archivio del tenant demo ha circa 34 clienti (4 reali + 30 di test creati per il backtest), sotto la soglia di 100 — il problema comparirà da solo appena l'anagrafica cresce oltre quella soglia",
    ],
    noteTraccia:
      "2026-08-22: individuato durante lo stesso stress test di CA-22 (stesso pattern: fetch a tetto fisso + filtro client-side invece di una ricerca server-side vera). NON ancora corretto: come per CA-22, serve prima decidere l'approccio di ricerca server-side (ILIKE con indice, o full-text) prima di toccare il codice.\n" +
      "2026-08-22 (nota): un'altra sessione, in parallelo, ha esteso searchAnagraficaClienti() per unire anche public.clienti (account web) oltre ad anagrafica_clienti — non un mio intervento. Su quella base ho solo alzato il tetto per fonte da 150 a 1000 righe (stessa mitigazione di CA-22, stessa motivazione: non è ancora una ricerca server-side vera, ma copre comodamente l'archivio di un locale reale per anni).",
    urgenza: "media",
    prontoDaProvare: true,
  },
  {
    codice: "CA-24",
    epic: "cassa",
    area: "cassa_planning",
    titolo: "Planning: layout più a colpo d'occhio con barra capacità forno",
    contesto:
      "L'utente non era soddisfatto della tabella planning esistente (troppo densa, difficile capire a colpo d'occhio quanto forno resta libero). Prima di riscriverla ho mostrato 3 direzioni alternative in anteprima (Artifact, non collegate all'app); l'utente ha scelto la direzione \"lista compatta\" e ha chiesto di renderla ancora più densa aggiungendo la barra di capacità vista in un'altra proposta.",
    richiesta:
      "Righe più basse, fasce senza consegne raggruppate invece di una riga vuota ciascuna, barra di capacità forno per fascia con colore che avvisa quando ci si avvicina al limite.",
    comeVerificare: [
      "Cassa → Planning: le fasce libere consecutive appaiono come una riga sola (es. \"17:45 – 18:00 — 2 fasce libere\")",
      "Ogni fascia con consegne mostra numero + barra colorata (teal sotto il 70% della capacità forno, ambra 70-99%, rossa al completo)",
      "Un ordine online ha un pallino arancione pieno accanto, un ordine telefonico un pallino grigio",
    ],
    noteTraccia:
      "2026-08-22: implementato in CassaPlanningBoard.jsx (che alimenta \"Situazione planning\" in Cassa). Aggiunto displayItems (raggruppa le fasce vuote consecutive), componente CapacityBar (numero + barra, tre soglie colore), pallino online riutilizzando isOrdineOnlineCanale() già esistente. Nessun cambio ai dati/props del componente, solo al rendering — nessun rischio per la logica di assegnazione pony. Lint pulito, 102 test invariati.",
    urgenza: "bassa",
    prontoDaProvare: true,
  },
  {
    codice: "CA-25",
    epic: "cassa",
    area: "cassa_clienti",
    titolo: "Nuovo cliente in Cassa: la mappa non mostrava l'area di consegna",
    contesto:
      "La mappa nel modale \"Nuovo cliente\" di Cassa era un semplice iframe di OpenStreetMap (solo inquadratura, nessuna possibilità di disegnare un contorno) — l'operatore non poteva vedere dove finisce davvero l'area di consegna del locale, a differenza del campo indirizzo del profilo cliente pubblico che invece la mostra già (mappa Leaflet vera).",
    richiesta: "Anche in Cassa deve essere visibile l'area di consegna sulla mappa, non solo un riquadro ritagliato.",
    comeVerificare: [
      "Cassa → Nuovo cliente: la mappa mostra il contorno verde dell'area di consegna configurata in Impostazioni",
      "Cerco un indirizzo o clicco sulla mappa → appare un puntatore trascinabile, capisco a colpo d'occhio se è dentro o fuori dal contorno",
    ],
    noteTraccia:
      "2026-08-22: sostituito l'iframe statico con una mappa Leaflet vera in NuovoClienteModal.jsx (stessa libreria e stesso pattern già usati in ClienteIndirizzoMappaField.jsx — nessuna nuova dipendenza). Disegna il poligono area di consegna, marker trascinabile per il punto cliente, clic sulla mappa per impostare il punto a mano. La ricerca indirizzo resta limitata all'area di consegna (bounded=1, comportamento invariato, richiesto esplicitamente in una sessione precedente) — la mappa ora almeno rende visibile perché un indirizzo appena fuori zona non trova suggerimenti. Lint pulito, 102 test invariati.",
    urgenza: "media",
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
  {
    codice: "SE-03",
    epic: "sicurezza",
    area: "sec_isolamento",
    titolo: "Advisor Supabase: view tenants SECURITY DEFINER + policy RLS ridondanti su tabelle rider",
    contesto:
      "Durante uno stress test generale, l'advisor di sicurezza/performance di Supabase segnala: (1) ERRORE — public.tenants (la view pubblica su admin.tenants, letta ovunque nell'app incluso dagli utenti anonimi sulla vetrina pubblica) è creata SECURITY DEFINER anziché SECURITY INVOKER, quindi gira sempre con i permessi di chi l'ha creata invece di applicare le policy RLS di chi la interroga; (2) 6 policy RLS (anagrafica_clienti, utenti_ruoli, turni_operatori, fidelity_movimenti, core.ordine_consegna_evento, notifiche_outbox) richiamano auth.uid() senza (select ...), ricalcolandolo per ogni riga invece che una volta sola; (3) 27 casi di policy RLS permissive duplicate sulle tabelle rider/delivery (core.consegna_percorso, consegna_percorso_ordine, ordine_consegna_evento, rider, rider_posizione, turno_rider) più public.clienti e public.turni_operatori — ogni query su quelle tabelle valuta più policy quando una sola basterebbe.",
    richiesta:
      "Da valutare caso per caso: i punti (2) e (3) sono puro overhead di performance, sicuri da sistemare quando c'è tempo per verificare ogni policy con calma. Il punto (1) invece è più delicato — public.tenants è quasi certamente letta anche da utenti anonimi (vetrina pubblica, checkout) proprio perché SECURITY DEFINER scavalca la RLS di admin.tenants: passare a SECURITY INVOKER senza prima verificare/creare una policy RLS anonima adeguata su admin.tenants rischierebbe di rompere la vetrina pubblica per i clienti non loggati.",
    comeVerificare: [
      "Non c'è modo di \"testare\" un advisor — sono controlli statici su definizioni DB, già confermati eseguendo l'advisor stesso",
    ],
    noteTraccia:
      "2026-08-22: individuato durante lo stress test generale su richiesta dell'utente. NON corretto: il punto (1) rischia di rompere la vetrina pubblica se toccato senza prima verificare le policy RLS di admin.tenants per il ruolo anon; i punti (2)/(3) sono a rischio più basso ma toccano 6+27 policy — da fare come intervento dedicato con verifica una per una, non incluso in questa sessione per non introdurre regressioni non testate.",
    urgenza: "media",
    prontoDaProvare: false,
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
