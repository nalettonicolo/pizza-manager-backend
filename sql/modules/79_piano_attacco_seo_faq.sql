-- Modulo 79 — Piano d'attacco go-to-market + FAQ pubbliche per SEO/AI
--
-- Origine: handoff sessione Claude mobile (mod 54), riscritto per lo schema reale
-- (public.utenti_ruoli invece di public.profiles.is_superadmin — vedi note in
-- 76_tenant_documenti_firma.sql). Dipende dal modulo 78 (tabella note_marketing).
-- Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Estendere le categorie di note_marketing
-- ---------------------------------------------------------
alter table public.note_marketing drop constraint if exists note_marketing_categoria_check;
alter table public.note_marketing add constraint note_marketing_categoria_check
  check (categoria in (
    'pricing', 'posizionamento', 'funnel_acquisizione', 'differenziazione',
    'messaggistica', 'seo', 'ai_visibility', 'social', 'go_to_market', 'altro'
  ));

-- ---------------------------------------------------------
-- 2) Piano d'attacco: note strategiche (agosto 2026)
-- ---------------------------------------------------------
insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'go_to_market',
  'Fase 0-3 mesi: primi clienti dalla rete diretta, non dal digitale',
  'Partire da colleghi pizzaioli, fornitori (mulini, formaggerie), corsi/associazioni. Offerta founding customer: prezzo bloccato a vita per i primi 10-15 clienti reali in cambio di feedback e disponibilità a fare da caso studio. Onboarding assistito personalmente da Nicolò nei primi clienti.',
  'alta', 'da_valutare'
),
(
  'funnel_acquisizione',
  'Referral tra pizzaioli',
  'Sconto per chi porta un altro pizzaiolo. Nel settore i titolari si conoscono tra loro molto più che in altri comparti: il referral vale più che in mercati generici.',
  'media', 'da_valutare'
),
(
  'seo',
  'Pagine di confronto con i concorrenti',
  '"PizzaManager vs Cassa in Cloud", "vs Dylog", "vs Trancio": pagine ad alta intenzione d''acquisto, chi cerca sta già confrontando. Trancio stesso le usa con ottimi risultati.',
  'alta', 'da_valutare'
),
(
  'seo',
  'Una landing per modulo',
  'Pagina dedicata per ordini online, cassa, comanda, delivery, magazzino, fidelity, contabilità, multi-sede: intercettano ricerche specifiche diverse invece di una sola pagina generica.',
  'media', 'da_valutare'
),
(
  'seo',
  'Blog con competenza reale da pizzaiolo',
  'Contenuti su food cost, gestione impasti, organizzazione turni delivery: portano traffico non-branded (chi cerca "come calcolare food cost pizza" non conosce ancora PizzaManager) e sono difficili da replicare per concorrenti senza background da pizzaiolo. Attenzione: seguire la preferenza già espressa di non menzionare il background da elettricista nei testi.',
  'media', 'da_valutare'
),
(
  'ai_visibility',
  'Blocchi FAQ con markup FAQPage, risposte dirette e fattuali',
  'I motori AI (ChatGPT, Perplexity, AI Overview di Google) privilegiano contenuti con domande-risposte esplicite e dirette. Rispondere chiaramente a "Quanto costa un gestionale per pizzeria?", "Qual è il miglior software per pizzeria con delivery?" aumenta le probabilità di essere citati. Tattica osservata su Trancio.',
  'alta', 'da_valutare'
),
(
  'ai_visibility',
  'Presenza su directory/aggregatori software',
  'Le AI attingono spesso a fonti terze (Capterra, GetApp e versioni italiane) per le risposte comparative, non solo al sito ufficiale. Da presidiare quando il prodotto sarà pubblico.',
  'media', 'da_valutare'
),
(
  'ai_visibility',
  'Coerenza dei dati tra sito, directory e social',
  'Nome prodotto, prezzo, funzionalità devono coincidere ovunque: le AI pesano la coerenza cross-fonte come segnale di affidabilità. Un prezzo diverso tra sito e una directory abbassa la fiducia del modello nella fonte.',
  'media', 'da_valutare'
),
(
  'social',
  'Gruppi Facebook di pizzaioli: valore prima, non promozione',
  'Canale molto attivo in Italia nel settore. Rispondere a domande vere per farsi conoscere come persona del mestiere prima che come venditore di software.',
  'media', 'da_valutare'
),
(
  'social',
  'Instagram/TikTok con contenuti reali, non demo asettiche',
  'Coerente con la narrazione già scelta: partire dall''esperienza da pizzaiolo, non da un prodotto software generico.',
  'bassa', 'da_valutare'
),
(
  'social',
  'YouTube: casi reali quando disponibili',
  'Video "come gestisco la serata con PizzaManager" da girare con clienti reali disposti a mostrarsi, non prima.',
  'bassa', 'da_valutare'
);

-- ---------------------------------------------------------
-- 3) FAQ pubbliche — sorgente unica per sito + JSON-LD FAQPage
-- ---------------------------------------------------------
create table if not exists public.faq_pubbliche (
  id uuid primary key default gen_random_uuid(),
  domanda text not null,
  risposta text not null,
  categoria text default 'generale',
  ordine integer not null default 0,
  pubblicata boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faq_pubbliche is
  'FAQ mostrate sul sito pubblico e usate per generare il markup JSON-LD FAQPage (SEO + visibilità nelle risposte AI).';

create index if not exists faq_pubbliche_ordine_idx on public.faq_pubbliche (ordine) where pubblicata = true;

alter table public.faq_pubbliche enable row level security;

-- Lettura pubblica (contenuto destinato al sito, non riservato)
create policy faq_pubbliche_public_select
  on public.faq_pubbliche
  for select
  using (pubblicata = true);

-- Scrittura solo superadmin
create policy faq_pubbliche_superadmin_write
  on public.faq_pubbliche
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- Contenuto iniziale
insert into public.faq_pubbliche (domanda, risposta, categoria, ordine) values
(
  'Quanto costa un gestionale per pizzeria?',
  'PizzaManager parte da 83€/mese per ordini a cassa, comanda e gestione consegne. I piani superiori aggiungono ordini online, fidelity, magazzino e contabilità avanzata. Nessun costo nascosto per operatori extra. Prezzo aggiornato sulla pagina piani del sito.',
  'pricing', 1
),
(
  'Qual è il miglior software per gestire una pizzeria con delivery?',
  'Un buon gestionale per pizzerie con delivery deve unire ordini online, assegnazione automatica dei rider, tracciamento in tempo reale e notifiche al cliente. PizzaManager integra questi moduli nativamente, pensati specificamente per il flusso di lavoro di una pizzeria.',
  'prodotto', 2
),
(
  'PizzaManager richiede hardware dedicato?',
  'No, PizzaManager funziona da browser su tablet, PC e smartphone già in dotazione. Non serve acquistare terminali POS proprietari, salvo si scelga volontariamente il noleggio operativo di attrezzature.',
  'prodotto', 3
),
(
  'PizzaManager gestisce anche magazzino e contabilità, non solo gli ordini?',
  'Sì. A differenza di molti gestionali per la ristorazione focalizzati solo su prenotazioni e comande, PizzaManager copre anche magazzino con inventario valorizzato, contabilità di base e gestione multi-sede per chi ha più locali.',
  'prodotto', 4
);

-- Nota strategica sull'uso di questa tabella
insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'ai_visibility',
  'faq_pubbliche come sorgente unica per sito e JSON-LD',
  'Le FAQ vanno mantenute in questa tabella (editabile da area superadmin) ed esposte sia come contenuto visibile sia come JSON-LD FAQPage nella stessa pagina, per evitare disallineamenti tra ciò che l''utente vede e ciò che leggono i crawler.',
  'alta', 'implementata'
);
