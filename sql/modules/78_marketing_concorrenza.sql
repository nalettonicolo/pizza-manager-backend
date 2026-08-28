-- Modulo 78 — Area Superadmin: Marketing e Concorrenza
--
-- Origine: handoff sessione Claude mobile (mod 53), riscritto per lo schema reale
-- (public.utenti_ruoli invece di public.profiles.is_superadmin — vedi note in
-- 76_tenant_documenti_firma.sql). Indipendente da 76/77, nessuna tabella tenant coinvolta.
-- Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Concorrenti monitorati
-- ---------------------------------------------------------
create table if not exists public.concorrenti (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url text,
  categoria text not null default 'gestionale_pizzeria' check (categoria in (
    'gestionale_pizzeria', 'gestionale_ristorazione_generico', 'pos_cassa', 'delivery_marketplace', 'altro'
  )),
  prezzo_min numeric(10,2),
  prezzo_max numeric(10,2),
  modello_prezzo text,        -- es. "flat unico", "a tier", "a modulo", "freemium"
  punti_forza text,
  punti_debolezza text,       -- es. funzionalità mancanti, gap sfruttabili
  note text,
  fonte_url text,             -- link alla pagina prezzi/analisi consultata
  ultima_verifica date default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.concorrenti is
  'Monitoraggio concorrenti per la strategia di pricing e posizionamento di PizzaManager. Sola area superadmin.';

alter table public.concorrenti enable row level security;

create policy concorrenti_superadmin_all
  on public.concorrenti
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 2) Note e punti chiave di strategia marketing/pricing
-- ---------------------------------------------------------
create table if not exists public.note_marketing (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in (
    'pricing', 'posizionamento', 'funnel_acquisizione', 'differenziazione', 'messaggistica', 'altro'
  )),
  titolo text not null,
  contenuto text not null,
  concorrente_rif uuid references public.concorrenti(id) on delete set null,
  priorita text not null default 'media' check (priorita in ('bassa', 'media', 'alta')),
  stato text not null default 'da_valutare' check (stato in ('da_valutare', 'approvata', 'scartata', 'implementata')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.note_marketing is
  'Punti chiave e idee strategiche su pricing, posizionamento e marketing, spesso derivati da analisi concorrenti.';

create index if not exists note_marketing_categoria_idx on public.note_marketing (categoria, priorita);

alter table public.note_marketing enable row level security;

create policy note_marketing_superadmin_all
  on public.note_marketing
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 3) Dati iniziali — analisi Trancio (agosto 2026)
-- ---------------------------------------------------------
insert into public.concorrenti (
  nome, url, categoria, prezzo_min, prezzo_max, modello_prezzo,
  punti_forza, punti_debolezza, note, fonte_url
) values (
  'Trancio',
  'https://trancio.app',
  'gestionale_ristorazione_generico',
  0, 29,
  'freemium: free per sempre + PRO flat 29€/mese',
  'Prezzo unico e semplice (no tier confusi); messaggio "nessun costo nascosto" molto ripetuto; operatori illimitati sempre; prova PRO 3gg senza carta; free forever molto generoso (include KDS, CRM, notifiche push); tabella di confronto esplicita vs media mercato (40-90€) in home; setup dichiarato "in 5 minuti"; supporto via WhatsApp.',
  'Nessun modulo cassa/POS per gli incassi; nessuna gestione magazzino; nessuna contabilità; nessuna gestione multi-sede. È focalizzato su front-of-house (prenotazioni, coda, KDS, delivery, CRM) e non su backend operativo/finanziario.',
  'Competono sul segmento "esperienza cliente e sala", non sul segmento "gestione operativa completa" dove si posiziona PizzaManager. Buon benchmark per un piano Base aggressivo, ma non copre le stesse esigenze di un piano Standard/Full.',
  'https://trancio.app/prezzi'
)
on conflict do nothing;

-- Punti chiave emersi dall'analisi, come note strategiche collegate al concorrente sopra
with c as (select id from public.concorrenti where nome = 'Trancio' limit 1)
insert into public.note_marketing (categoria, titolo, contenuto, concorrente_rif, priorita, stato)
select 'posizionamento',
  'Un solo prezzo per tier, non una griglia complessa',
  'Trancio usa un prezzo unico (0€ / 29€) invece di più tier: riduce l''ansia da scelta. Per PizzaManager: mantenere al massimo 3 tier chiari, evitare sotto-opzioni confuse dentro ogni piano.',
  c.id, 'media', 'da_valutare' from c
union all
select 'messaggistica',
  'Confronto esplicito col prezzo medio di mercato',
  'Trancio mostra apertamente "40-90€ media mercato" vs il proprio prezzo, in home page. Per il lancio: creare una tabella di confronto pubblica simile una volta definiti i prezzi finali.',
  c.id, 'media', 'da_valutare' from c
union all
select 'messaggistica',
  '"Nessun costo nascosto" come messaggio ricorrente',
  'Ripetuto più volte nel sito Trancio: nessun costo per operatori extra, moduli, hardware. È un dolore reale del settore. Da adottare nella comunicazione di PizzaManager, specialmente per i piani Standard/Full.',
  c.id, 'alta', 'da_valutare' from c
union all
select 'pricing',
  'Operatori illimitati in tutti i piani',
  'Trancio non fa pagare per operatore. Consigliato adottare la stessa logica: il valore va fatto sui moduli, non sul numero di account, per non creare frizione nei locali con più personale.',
  c.id, 'alta', 'da_valutare' from c
union all
select 'funnel_acquisizione',
  'Ingresso a frizione zero: prova senza carta, nessuna perdita dati al termine',
  'Trancio offre 3 giorni PRO senza carta di credito, poi ricade su un piano Free senza perdere i dati inseriti. Per PizzaManager: valutare una prova gratuita di 14-30gg senza carta come pratica minima, eventualmente con downgrade automatico anziché blocco totale.',
  c.id, 'media', 'da_valutare' from c
union all
select 'differenziazione',
  'Gap di Trancio: nessun modulo cassa, magazzino, contabilità, multi-sede',
  'Trancio copre solo il fronte "esperienza cliente e sala" (prenotazioni, coda, KDS, delivery, CRM). PizzaManager può posizionarsi come soluzione operativa completa (cassa + magazzino valorizzato + contabilità + multi-sede), un terreno che Trancio non presidia — più vicino a Cassa in Cloud/Dylog ma con UX più moderna e prezzo mirato alle pizzerie.',
  c.id, 'alta', 'da_valutare' from c
union all
select 'pricing',
  'Strategia consigliata: Base aggressivo su Trancio, Standard/Full sul terreno backend',
  'Piano Base (~29-39€/mese: ordini online + cassa + comanda) in diretta concorrenza di prezzo con Trancio PRO. Piano Standard/Full (magazzino, contabilità, multi-sede) posizionato invece contro player più pesanti come Cassa in Cloud/Dylog, dove il prezzo più alto è giustificato dalla profondità funzionale.',
  c.id, 'alta', 'da_valutare' from c
on conflict do nothing;
