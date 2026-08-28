-- Modulo 97 — Censimento concorrenti e nota strategica: riposizionamento prezzi 2026-08
--
-- Arricchisce la tabella concorrenti (era censito solo "Trancio", freemium ma senza cassa/
-- magazzino/contabilità) con due competitor diretti sullo stesso segmento di PizzaManager
-- (gestione operativa completa), trovati via ricerca web con fonti verificabili. La nota in
-- note_marketing traccia il ragionamento e i numeri dietro l'aggiustamento prezzi applicato in
-- src/config/serviziAppRegistro.js nello stesso giro di lavoro.
--
-- Dati puramente informativi (nessuno schema nuovo, nessun grant): idempotente solo nel senso
-- che riapplicarlo duplica le righe (id generati con gen_random_uuid()) — non pensato per essere
-- rieseguito, riportato qui solo per lo storico/audit trail, come gli altri moduli sql/.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__execute_sql.

insert into public.concorrenti (id, nome, url, categoria, prezzo_min, prezzo_max, modello_prezzo, punti_forza, punti_debolezza, note, fonte_url, ultima_verifica)
values
(
  gen_random_uuid(),
  'Cassa in Cloud (TeamSystem)',
  'https://www.teamsystem.com/horeca/cassa-in-cloud/',
  'gestionale_ristorazione_generico',
  40.00,
  100.00,
  'abbonamento a scalare per funzioni: base 40€/mese, piano intermedio (tavoli, magazzino, listini multipli, statistiche avanzate, supporto prioritario) 40-80€/mese, fino a 100€/mese per il completo',
  'Brand consolidato (TeamSystem) con fiducia/affidabilità percepita alta; copre sala, cucina, comande, delivery e magazzino in un unico prodotto — competitor diretto sullo stesso segmento di PizzaManager; assistenza anche festivi, installazione in loco e formazione inclusa.',
  'Prezzo a scaglioni poco trasparente (si scopre il totale solo configurando); pensato per retail/horeca generico, non specializzato su pizzeria (impasti, food cost pizza, ecc.); nessuna vetrina/ordini online nativa evidenziata come punto di forza.',
  'Competitor diretto sul segmento "gestione operativa completa" (stesso terreno di PizzaManager Base/Pro): la fascia 40-100€/mese è il riferimento più solido per calibrare i nostri piani Base/Pro, più di Trancio che copre un segmento diverso.',
  'https://www.teamsystem.com/horeca/cassa-in-cloud/prezzi/',
  current_date
),
(
  gen_random_uuid(),
  'Appresto',
  'https://www.appresto.cloud/software-pizzeria',
  'gestionale_pizzeria',
  null,
  null,
  'preventivo su misura: dipende da postazioni cassa, tablet comande e moduli attivati (magazzino, prenotazioni, ordini online) — nessun prezzo pubblico fisso',
  'Specializzato su pizzeria (non genericamente ristorazione); cloud, nessun costo hardware proprietario obbligatorio; fatturazione elettronica e scontrino elettronico inclusi.',
  'Prezzo non trasparente in vetrina pubblica (serve richiesta preventivo, frizione per chi confronta velocemente); posizionamento e differenziazione poco chiari dal sito.',
  'Competitor diretto per posizionamento (pizzeria-specifico), ma la loro scelta di nascondere il prezzo è un punto a favore nostro se continuiamo a mostrare prezzi chiari in vetrina pubblica.',
  'https://www.appresto.cloud/software-pizzeria',
  current_date
);

insert into public.note_marketing (id, categoria, titolo, contenuto, priorita, stato)
values (
  gen_random_uuid(),
  'pricing',
  'Riposizionamento prezzi 2026-08: piano Base avvicinato alla fascia di mercato reale',
  'Analisi comparativa (Trancio: freemium+PRO 29€/mese ma senza cassa/magazzino/contabilità; Cassa in Cloud/TeamSystem: 40-100€/mese, competitor diretto stesso segmento; mercato generale gestionali cloud ristorazione: canone 80-150€/mese). Il nostro piano Base aggregato (somma servizi inclusi) era 83€/mese: giustificato dal valore (copre cassa+comanda+consegne+magazzino+contabilità, cosa che Trancio non fa), ma quasi 2x il "base" di Cassa in Cloud (40€) — barriera d''ingresso alta per il target primario (piccola pizzeria).
Deciso di ridurre 3 prezzi servizio "core" del piano Base: ordini_cassa 25→22€, stampa_comanda 10→8€, magazzino_gestione 15→12€ (-8€ totali). Nuovo Base: 75€/mese (sotto la soglia psicologica di 80€, dentro la fascia 40-100€ di Cassa in Cloud). Effetto a cascata sugli altri piani (stessa riduzione assoluta, dato che sono somme cumulative dei servizi): Pro 133→125€, Enterprise 175→167€, Full 524→516€.
Non toccati: ordini_online (35€, differenziatore chiave vs Trancio/Cassa in Cloud che non lo evidenziano), tablet_ruoli (42€, feature enterprise di valore alto), servizi enterprise su misura (api_integrazioni, account_manager, sla_personalizzazioni — quelli restano a preventivo/negoziazione, coerente con come li tratta anche Appresto).
Fonte prezzi aggiornata in src/config/serviziAppRegistro.js (fonte di verità pubblicata) — sql/modules/97_note_pricing_2026_08.sql per il tracciamento.',
  'alta',
  'implementata'
);
