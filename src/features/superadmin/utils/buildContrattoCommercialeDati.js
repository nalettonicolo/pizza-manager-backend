/**
 * Compila i DATI del "Contratto commerciale" (tipo_documento = contratto_commerciale) a partire
 * dai dati REALI del tenant — servizi selezionati (con prezzo) e attrezzature a noleggio attive —
 * invece del testo fisso [PLACEHOLDER] del Contratto di Abbonamento generico. Richiesta esplicita:
 * "il contratto deve essere compilato in base ai servizi o attrezzature che inserisco io in fase
 * di contratto".
 *
 * Restituisce un oggetto STRUTTURATO (non più un array di paragrafi piatti): il layout PDF
 * (contrattoCommercialePdfBuilder.js) lo usa per disegnare intestazione a due colonne e tabelle
 * servizi/attrezzature in stile fattura, richiesta esplicita dell'utente dopo aver visto la prima
 * versione ("non mi piace, a sx voglio i miei dati e a dx quelli del cliente").
 *
 * @param {object} args
 * @param {object} args.fornitore - riga public.fornitore_config
 * @param {object} args.tenant - dati fiscali tenant (nome, partita_iva, email_fatturazione, pec, ...)
 * @param {Array<{id:string,nome:string,prezzoMensile:number}>} args.serviziSelezionati
 * @param {Array<object>} args.attrezzatureAttive - righe public.tenant_noleggi con stato 'attivo'/'in_attesa'
 *   (tipo='noleggio': canone_mensile/cauzione ricorrenti; tipo='vendita': prezzo_vendita_totale una tantum)
 * @param {string} [args.nomePiano]
 */
export function buildContrattoCommercialeDati({
  fornitore,
  tenant,
  serviziSelezionati = [],
  attrezzatureAttive = [],
  nomePiano = "",
}) {
  const f = fornitore || {};
  const t = tenant || {};

  const noleggi = attrezzatureAttive.filter((a) => (a.tipo || "noleggio") === "noleggio");
  const vendite = attrezzatureAttive.filter((a) => a.tipo === "vendita");

  const totaleServizi = serviziSelezionati.reduce((s, r) => s + (Number(r.prezzoMensile) || 0), 0);
  const totaleNoleggio = noleggi.reduce((s, r) => s + (Number(r.canone_mensile) || 0), 0);
  const totaleCauzioni = noleggi.reduce((s, r) => s + (Number(r.cauzione) || 0), 0);
  const totaleVenditaUnaTantum = vendite.reduce((s, r) => s + (Number(r.prezzo_vendita_totale) || 0), 0);
  const totaleMensile = totaleServizi + totaleNoleggio;

  return {
    fornitore: {
      ragioneSociale: f.ragione_sociale || "[Ragione sociale Fornitore]",
      indirizzo: f.indirizzo || "[Indirizzo Fornitore]",
      piva: f.piva || "[P.IVA Fornitore]",
      legaleRappresentante: f.legale_rappresentante || "[Legale rappresentante]",
      foroCompetente: f.foro_competente || "[Foro competente Fornitore]",
    },
    cliente: {
      nome: t.nome || "[Ragione sociale Cliente]",
      piva: t.partita_iva || "",
      contatto: t.email_fatturazione || t.pec || "",
    },
    nomePiano,
    servizi: serviziSelezionati.map((s) => ({ nome: s.nome, prezzoMensile: Number(s.prezzoMensile) || 0 })),
    attrezzature: attrezzatureAttive.map((a) => ({
      nome: a.elenco_attrezzature || "Attrezzatura",
      quantita: a.quantita_totale || 1,
      tipo: a.tipo === "vendita" ? "vendita" : "noleggio",
      canoneMensile: Number(a.canone_mensile) || 0,
      cauzione: Number(a.cauzione) || 0,
      prezzoVenditaTotale: Number(a.prezzo_vendita_totale) || 0,
    })),
    totaleServizi,
    totaleNoleggio,
    totaleCauzioni,
    totaleVenditaUnaTantum,
    totaleMensile,
    clausole: [
      "[PLACEHOLDER] Durata, rinnovo, recesso e modalità di sospensione del servizio in caso di mancato pagamento: da completare con testo legale validato prima dell'uso vincolante.",
      "[PLACEHOLDER] Responsabilità, limitazioni di garanzia e trattamento dati (rimanda a Privacy Policy e DPA sottoscritti separatamente).",
      `[PLACEHOLDER] Foro competente: ${f.foro_competente || "[Foro competente Fornitore]"}.`,
      ...(totaleVenditaUnaTantum > 0
        ? ["[PLACEHOLDER] L'hardware in vendita (una tantum) si intende pagato anticipatamente o alla consegna salvo diverso accordo scritto; la proprietà passa al Cliente al saldo integrale."]
        : []),
      "Il presente contratto sostituisce, per la parte economica (servizi e attrezzature), ogni accordo verbale o precedente non formalizzato per iscritto.",
    ],
  };
}
