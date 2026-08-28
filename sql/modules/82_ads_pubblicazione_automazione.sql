-- Modulo 82 — Ads: contenuto annuncio, programmazione, pubblicazione via n8n/API
--
-- Origine: handoff sessione Claude mobile (mod 57), riscritto per lo schema reale
-- (public.utenti_ruoli invece di public.profiles.is_superadmin — vedi note in
-- 76_tenant_documenti_firma.sql). Da applicare DOPO il modulo 81 (altera campagne_ads).
-- Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Estendere campagne_ads con contenuto annuncio e programmazione
-- ---------------------------------------------------------
alter table public.campagne_ads add column if not exists titolo_annuncio text;
alter table public.campagne_ads add column if not exists testo_annuncio text;
alter table public.campagne_ads add column if not exists url_immagine text;
alter table public.campagne_ads add column if not exists cta text default 'Scopri di più';
alter table public.campagne_ads add column if not exists data_pubblicazione_programmata timestamptz;
alter table public.campagne_ads add column if not exists canale_pubblicazione text
  check (canale_pubblicazione in ('manuale', 'n8n', 'api_diretta')) default 'manuale';
alter table public.campagne_ads add column if not exists pubblicata_il timestamptz;

-- Estendere gli stati possibili con 'programmata'
alter table public.campagne_ads drop constraint if exists campagne_ads_stato_check;
alter table public.campagne_ads add constraint campagne_ads_stato_check
  check (stato in ('bozza', 'programmata', 'attiva', 'in_pausa', 'conclusa'));

-- ---------------------------------------------------------
-- 2) Integrazioni di pubblicazione (n8n come piano B, API dirette in futuro)
-- ---------------------------------------------------------
create table if not exists public.integrazioni_automazione (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                 -- es. "n8n - pubblica campagna Google Ads"
  tipo text not null check (tipo in ('n8n_webhook', 'api_diretta')),
  piattaforma text check (piattaforma in ('google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads', 'altro')),
  url_webhook text,                   -- URL del webhook n8n (o endpoint intermedio)
  secret_token text,                  -- token condiviso per validare le chiamate, se previsto da n8n
  attiva boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integrazioni_automazione is
  'Configurazione dei canali di pubblicazione automatica delle campagne Ads: webhook n8n come soluzione ponte, oppure integrazione diretta con le API delle piattaforme in futuro.';

alter table public.integrazioni_automazione enable row level security;

create policy integrazioni_automazione_superadmin_all
  on public.integrazioni_automazione
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 3) Log dei tentativi di pubblicazione
-- ---------------------------------------------------------
create table if not exists public.campagne_ads_pubblicazioni_log (
  id uuid primary key default gen_random_uuid(),
  campagna_id uuid not null references public.campagne_ads(id) on delete cascade,
  integrazione_id uuid references public.integrazioni_automazione(id) on delete set null,
  tentato_at timestamptz not null default now(),
  esito text not null check (esito in ('in_coda', 'successo', 'fallito')),
  dettaglio text,           -- messaggio di errore o risposta ricevuta
  created_by uuid references auth.users(id)
);

create index if not exists campagne_ads_pubblicazioni_log_campagna_idx
  on public.campagne_ads_pubblicazioni_log (campagna_id, tentato_at desc);

alter table public.campagne_ads_pubblicazioni_log enable row level security;

create policy campagne_ads_pubblicazioni_log_superadmin_all
  on public.campagne_ads_pubblicazioni_log
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 4) Riga di configurazione n8n in bozza, da completare con l'URL reale
-- ---------------------------------------------------------
insert into public.integrazioni_automazione (nome, tipo, piattaforma, url_webhook, attiva, note) values
(
  'n8n — pubblica campagna (generico)',
  'n8n_webhook',
  'altro',
  null, -- da compilare con l'URL del webhook n8n reale quando pronto
  false,
  'Piano B in attesa di un agente dedicato o di integrazione diretta con le API delle piattaforme ads. Il workflow n8n riceve il payload della campagna e si occupa di crearla/programmarla sulla piattaforma target, poi richiama (o viene interrogato da) una seconda Edge Function per aggiornare campagne_ads_pubblicazioni_log.'
)
on conflict do nothing;

insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'go_to_market',
  'Pubblicazione campagne: n8n come piano B, agente dedicato o API dirette come obiettivo',
  'Predisposta la struttura per pubblicare/programmare campagne dalla console: campo canale_pubblicazione (manuale/n8n/api_diretta), tabella integrazioni_automazione per i webhook, log dei tentativi. Se non si integra un agente AI dedicato, il workflow su n8n resta la soluzione ponte più rapida da attivare.',
  'media', 'da_valutare'
);
