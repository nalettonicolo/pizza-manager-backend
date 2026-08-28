import { formatEuroMonth } from "@/features/superadmin/catalog/servicesStorage";

/**
 * Compila i paragrafi del "Contratto commerciale" (tipo_documento = contratto_commerciale) a
 * partire dai dati REALI del tenant — servizi selezionati (con prezzo) e attrezzature a noleggio
 * attive — invece del testo fisso [PLACEHOLDER] del Contratto di Abbonamento generico. Richiesta
 * esplicita: "il contratto deve essere compilato in base ai servizi o attrezzature che inserisco
 * io in fase di contratto".
 *
 * @param {object} args
 * @param {object} args.fornitore - riga public.fornitore_config
 * @param {object} args.tenant - dati fiscali tenant (nome, partita_iva, ...)
 * @param {Array<{id:string,nome:string,prezzoMensile:number}>} args.serviziSelezionati
 * @param {Array<object>} args.attrezzatureAttive - righe public.tenant_noleggi con stato 'attivo'/'in_attesa'
 * @param {string} [args.nomePiano]
 * @returns {string[]}
 */
export function buildContrattoCommercialeParagrafi({
  fornitore,
  tenant,
  serviziSelezionati = [],
  attrezzatureAttive = [],
  nomePiano = "",
}) {
  const f = fornitore || {};
  const t = tenant || {};

  const intestazione = [
    `Tra ${f.ragione_sociale || "[Ragione sociale Fornitore]"}, con sede in ${f.indirizzo || "[Indirizzo Fornitore]"}, P.IVA ${f.piva || "[P.IVA Fornitore]"}, in persona del legale rappresentante ${f.legale_rappresentante || "[Legale rappresentante]"} ("Fornitore"),`,
    `e ${t.nome || "[Ragione sociale Cliente]"}${t.partita_iva ? `, P.IVA ${t.partita_iva}` : ""} ("Cliente"),`,
    "si conviene e stipula quanto segue.",
  ];

  const totaleServizi = serviziSelezionati.reduce((s, r) => s + (Number(r.prezzoMensile) || 0), 0);
  const totaleNoleggio = attrezzatureAttive.reduce((s, r) => s + (Number(r.canone_mensile) || 0), 0);
  const totaleCauzioni = attrezzatureAttive.reduce((s, r) => s + (Number(r.cauzione) || 0), 0);
  const totaleMensile = totaleServizi + totaleNoleggio;

  const sezioneServizi = [
    `Oggetto — Servizi PizzaManager sottoscritti${nomePiano ? ` (piano "${nomePiano}")` : ""}:`,
    ...(serviziSelezionati.length
      ? serviziSelezionati.map((s) => `• ${s.nome} — ${formatEuroMonth(Number(s.prezzoMensile) || 0)}`)
      : ["Nessun servizio a canone aggiuntivo oltre al piano base."]),
    `Totale servizi: ${formatEuroMonth(totaleServizi)}.`,
  ];

  const sezioneAttrezzature = attrezzatureAttive.length
    ? [
        "Attrezzature a noleggio operativo:",
        ...attrezzatureAttive.map((a) => {
          const cauzioneTxt = Number(a.cauzione) > 0 ? `, cauzione ${formatEuroMonth(Number(a.cauzione))}` : "";
          return `• ${a.elenco_attrezzature || "Attrezzatura"} (x${a.quantita_totale || 1}) — canone ${formatEuroMonth(Number(a.canone_mensile) || 0)}${cauzioneTxt}`;
        }),
        `Totale noleggio attrezzature: ${formatEuroMonth(totaleNoleggio)}${totaleCauzioni > 0 ? ` + cauzioni ${formatEuroMonth(totaleCauzioni)} (una tantum)` : ""}.`,
      ]
    : ["Nessuna attrezzatura a noleggio inclusa in questo contratto."];

  const sezioneEconomica = [
    `Totale canone mensile complessivo: ${formatEuroMonth(totaleMensile)} (IVA esclusa salvo diversa indicazione in fattura).`,
    "Fatturazione mensile posticipata salvo diverso accordo scritto tra le parti.",
  ];

  const clausoleGenerali = [
    "[PLACEHOLDER] Durata, rinnovo, recesso e modalità di sospensione del servizio in caso di mancato pagamento: da completare con testo legale validato prima dell'uso vincolante.",
    "[PLACEHOLDER] Responsabilità, limitazioni di garanzia e trattamento dati (rimanda a Privacy Policy e DPA sottoscritti separatamente).",
    `[PLACEHOLDER] Foro competente: ${f.foro_competente || "[Foro competente Fornitore]"}.`,
    "Il presente contratto sostituisce, per la parte economica (servizi e attrezzature), ogni accordo verbale o precedente non formalizzato per iscritto.",
  ];

  return [...intestazione, ...sezioneServizi, ...sezioneAttrezzature, ...sezioneEconomica, ...clausoleGenerali];
}
