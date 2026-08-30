/**
 * Mappa dei flussi operativi come sono programmati OGGI (dopo l'allineamento del flusso ordini).
 * Pagina Super Admin → Flussi. Quando il comportamento desiderato cambia,
 * si aggiorna qui il testo e il codice dei reparti in parallelo.
 */

export const FLUSSI_SYNC = {
  titolo: "Come parlano le schermate",
  punti: [
    "Appena un ordine viene creato o cambia stato, le altre schermate aperte si aggiornano da sole (canale live).",
    "Se più reparti sono aperti sullo stesso computer (anche «Test 4 reparti»), parte anche un segnale interno immediato: niente attesa.",
    "Il passaggio Pizzaiolo → Bancone è quasi istantaneo: appena il pizzaiolo preme «In forno», la comanda compare in Bancone entro un secondo.",
    "Se il canale live non arriva, ogni schermata si ricarica da sola ogni 8 secondi, come rete di sicurezza — non come modo normale di lavorare.",
  ],
}

export const FLUSSI_PERCORSI = [
  {
    id: "negozio",
    titolo: "Ritiro in negozio",
    passi: [
      "Cassa crea l’ordine (In preparazione). Senza tablet: la comanda si stampa in cassa (e la ricevuta se impostata in Impostazioni). Con tablet: i pizzaioli ricevono l’ordine sul tablet.",
      "Cucina (se attiva) vede solo le preparazioni da fare; altrimenti le fa il Bancone.",
      "Pizzaiolo preme «In forno» → l’ordine diventa In cottura e la comanda compare subito in Bancone.",
      "Bancone preme il tasto verde «Consegnato» → l’ordine è chiuso (Consegnato) con un solo click.",
      "Al click card e chip di quell’ordine spariscono da Bancone; i task di Cucina spariscono.",
    ],
  },
  {
    id: "delivery",
    titolo: "Consegna a domicilio",
    passi: [
      "Come il ritiro fino al forno: Cassa/vetrina crea l’ordine con indirizzo, pizzaiolo «In forno» → In cottura.",
      "Bancone preme il tasto verde, che per il domicilio è «In consegna»: l’ordine diventa Pronto e viene assegnato al Delivery; card e chip spariscono da Bancone.",
      "L’ordine compare nella schermata Delivery. Il pony (A o B) dal suo telefono preme «In consegna»: parte In viaggio e al cliente arriva la notifica «In consegna».",
      "A destinazione il rider conferma «Consegnato» (con eventuale prova). L’assegnazione al pony permette alla cassa di vedere la posizione live e di velocizzare i conteggi di fine serata.",
    ],
  },
  {
    id: "web",
    titolo: "Ordine dalla vetrina",
    passi: [
      "Con ordini online attivi e accettazione automatica: l’ordine entra nel programma senza attese.",
      "Con accettazione manuale: il cliente attende che la pizzeria accetti (In preparazione) o rifiuti (Annullato); qui il pagamento online NON è disponibile (un rifiuto su ordine già pagato renderebbe complicato il rimborso).",
      "Da lì l’ordine segue il percorso ritiro o domicilio, a seconda del tipo scelto dal cliente.",
    ],
  },
  {
    id: "tavolo",
    titolo: "Tavolo (sala) — Coming soon",
    passi: [
      "Servizio non ancora in produzione: sarà possibile creare i tavoli, personalizzarne forma e disposizione, poi il menù con coperto.",
      "In roadmap: apertura/chiusura conto da Cassa. Per ora resta un servizio «coming soon».",
    ],
  },
]

export const FLUSSI_REPARTI = [
  {
    id: "cassa",
    nome: "Cassa",
    schermata: "Cassa",
    percorso: "/operative/cassa",
    vede: "Tutti gli ordini di oggi nella colonna di sinistra: ogni cella ha un’icona di stato per monitorare il flusso a colpo d’occhio (in preparazione, in cottura, pronto, in consegna, consegnato).",
    fa: "Crea l’ordine (In preparazione). Accetta/rifiuta gli ordini web. Annulla, modifica, pagamenti, stampa comanda. Sui pagamenti online problematici mostra un triangolo giallo di avviso.",
    passaggio: "Non porta l’ordine in cottura (lo fa il pizzaiolo) né consegna a domicilio (lo fa il Delivery). Può seguire tutto dalla mappa live e dalle icone di stato.",
  },
  {
    id: "pizzaioli",
    nome: "Pizzaioli",
    schermata: "Pizzaioli",
    percorso: "/operative/pizzaioli",
    vede: "Solo ordini In preparazione, nella finestra oraria impostata (di default i prossimi 45 minuti). Due colonne: ritiro e domicilio.",
    fa: "Tasto «In forno»: porta l’ordine In cottura (non più direttamente a Pronto). Può anche segnare le preparazioni cucina sullo stesso ordine.",
    passaggio: "Dopo «In forno» la card sparisce da qui e la comanda compare in Bancone entro un secondo.",
  },
  {
    id: "cucina",
    nome: "Cucina",
    schermata: "Cucina",
    percorso: "/operative/cucina",
    vede: "Solo le preparazioni da fare, per fascia oraria (tab), degli ordini In preparazione e In cottura. Nessuna lista completa delle pizze: quella resta ai Pizzaioli.",
    fa: "Si toccano i task di preparazione. Non cambia lo stato dell’ordine.",
    passaggio: "Se il tablet Cucina è spento, questa schermata reindirizza a Bancone e le prep si fanno lì. I task di un ordine restano finché il Bancone non chiude il giro con il tasto verde: a quel punto spariscono.",
  },
  {
    id: "bancone",
    nome: "Bancone",
    schermata: "Bancone",
    percorso: "/operative/bancone",
    vede: "Card degli ordini In cottura (usciti dal «In forno» dei pizzaioli). A sinistra i chip da preparare/prendere (bibite, ingredienti), che restano finché non si chiude il giro.",
    fa: "Ritiro: tasto verde «Consegnato» → chiude l’ordine. Domicilio: tasto verde «In consegna» → porta l’ordine Pronto e lo assegna al Delivery. Chip bibite e promemoria locali.",
    passaggio: "Dopo il click card e chip di quell’ordine spariscono insieme. Se era un domicilio, l’ordine passa al Delivery (non è ancora consegnato: lo chiuderà il rider).",
  },
  {
    id: "delivery",
    nome: "Delivery",
    schermata: "Delivery",
    percorso: "/operative/delivery",
    vede: "Solo domicili Pronto assegnati dal Bancone, non ancora consegnati. Pony e Rider usano la stessa schermata; la mappa live mostra negozio, motorini colorati per pony e case dei clienti, con filtro tutti/singolo pony.",
    fa: "«In consegna» → In viaggio (il cliente riceve la notifica). «Consegnato» → chiusura con eventuale prova (foto/note). Al login il pony indica il proprio nome, così compare sulla mappa.",
    passaggio: "Finché è In viaggio resta in lista. A Consegnato sparisce. Non esiste più lo step manuale «Assegnato»: si va diretti a «In consegna».",
  },
]

export const FLUSSI_STATI = [
  { da: "In attesa", a: "In preparazione oppure Annullato", chi: "Cassa (accetta / rifiuta ordine web)" },
  { da: "In preparazione", a: "In cottura oppure Annullato", chi: "Pizzaiolo (In forno); Cassa (Annullato)" },
  { da: "In cottura", a: "Consegnato (negozio) oppure Pronto (domicilio) oppure Annullato", chi: "Bancone (tasto verde); Cassa (Annullato)" },
  { da: "Pronto (domicilio)", a: "In viaggio → Consegnato, oppure Annullato", chi: "Rider Delivery (In consegna / Consegnato); Cassa (Annullato)" },
  { da: "Consegnato / Annullato", a: "Nessuno: sono chiusi", chi: "Non si riaprono da queste schermate" },
]

export const FLUSSI_CONSEGNA = [
  { tasto: "Consegnato (Bancone, ritiro)", effetto: "Chiude subito l’ordine come Consegnato: la pizza è consegnata al banco." },
  { tasto: "In consegna (Bancone, domicilio)", effetto: "Porta l’ordine Pronto e lo assegna al Delivery. Non lo chiude: comparirà nella schermata Delivery." },
  { tasto: "In consegna (Delivery, rider)", effetto: "Il rider prende in carico: ordine In viaggio e notifica «In consegna» al cliente." },
  { tasto: "Consegnato (Delivery, rider)", effetto: "Chiude la consegna con eventuale prova: ordine Consegnato." },
]

/**
 * Correzioni applicate: i punti che prima «non combaciavano» e come sono stati risolti.
 * (id mantenuti per continuità/tracciabilità.)
 */
export const FLUSSI_MISMATCH = [
  {
    id: "bancone-in-consegna",
    titolo: "Bancone «In consegna» ora passa al rider",
    fatto: "Prima: sul domicilio il tasto diceva «In consegna» ma salvava Consegnato, e il Delivery perdeva l’ordine.",
    attesoHint: "Adesso: il Bancone mette l’ordine Pronto e lo assegna al Delivery; sarà il rider a metterlo In viaggio e poi Consegnato.",
  },
  {
    id: "due-chiusure-delivery",
    titolo: "Una sola regola per chiudere il domicilio",
    fatto: "Prima: si poteva chiudere sia da Bancone sia da Delivery, chi cliccava per primo vinceva.",
    attesoHint: "Adesso: il Bancone assegna, il rider consegna. La chiusura del domicilio (Consegnato) spetta al rider.",
  },
  {
    id: "pizzaiolo-in-forno",
    titolo: "Pizzaioli: «In forno» = In cottura",
    fatto: "Prima: «In forno» portava l’ordine direttamente a Pronto (fine cottura).",
    attesoHint: "Adesso: «In forno» mette l’ordine In cottura; è il Bancone a chiudere il giro (Consegnato o In consegna).",
  },
  {
    id: "chip-vs-card",
    titolo: "Bancone: card e chip spariscono insieme",
    fatto: "Prima: per un domicilio i chip a sinistra sparivano ma la card a destra restava.",
    attesoHint: "Adesso: alla pressione del tasto verde, card e chip dell’ordine spariscono insieme.",
  },
  {
    id: "copy-assegnato",
    titolo: "Delivery: testo allineato al tasto «In consegna»",
    fatto: "Prima: in pagina si leggeva ancora lo step «Assegnato» che come tasto non esisteva più.",
    attesoHint: "Adesso: il testo descrive il tasto unico «In consegna» → In viaggio → Consegnato.",
  },
]
