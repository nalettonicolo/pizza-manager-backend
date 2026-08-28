-- Modulo 81 — Area Marketing: gestione campagne Ads
--
-- Origine: handoff sessione Claude mobile (mod 56), riscritto per lo schema reale
-- (public.utenti_ruoli invece di public.profiles.is_superadmin — vedi note in
-- 76_tenant_documenti_firma.sql). Dipende dal modulo 80 (tabella landing_pages).
-- Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Campagne
-- ---------------------------------------------------------
create table if not exists public.campagne_ads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  piattaforma text not null check (piattaforma in (
    'google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads', 'altro'
  )),
  obiettivo text check (obiettivo in (
    'lead', 'traffico', 'conversione_iscrizione', 'notorieta', 'altro'
  )),
  landing_page_id uuid references public.landing_pages(id) on delete set null,
  stato text not null default 'bozza' check (stato in (
    'bozza', 'attiva', 'in_pausa', 'conclusa'
  )),
  budget_giornaliero numeric(10,2),
  budget_totale numeric(10,2),
  data_inizio date,
  data_fine date,
  -- Parametri UTM per costruire l'URL di destinazione tracciato
  utm_source text,       -- es. google, facebook, tiktok
  utm_medium text default 'cpc',
  utm_campaign text,     -- es. lancio-2026, vs-trancio
  utm_content text,
  riferimento_esterno_id text, -- id campagna lato piattaforma ads, quando integrata
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.campagne_ads is
  'Campagne pubblicitarie (Google/Meta/TikTok Ads...) collegate a una landing page interna, con parametri UTM per il tracciamento. Nessuna integrazione API diretta con le piattaforme ads in questa fase: gestione manuale.';

create index if not exists campagne_ads_stato_idx on public.campagne_ads (stato, piattaforma);

alter table public.campagne_ads enable row level security;

create policy campagne_ads_superadmin_all
  on public.campagne_ads
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 2) Metriche giornaliere per campagna
-- ---------------------------------------------------------
-- Inserimento manuale finché non c'è un'integrazione con le API delle
-- piattaforme ads (Google Ads API, Meta Marketing API). Una riga per
-- campagna/giorno, con vincolo di unicità per evitare doppioni.
create table if not exists public.campagne_ads_metriche (
  id uuid primary key default gen_random_uuid(),
  campagna_id uuid not null references public.campagne_ads(id) on delete cascade,
  data date not null,
  impressioni integer default 0,
  click integer default 0,
  conversioni integer default 0,
  spesa numeric(10,2) default 0,
  fonte text not null default 'manuale' check (fonte in ('manuale', 'api')),
  created_at timestamptz not null default now()
);

create unique index if not exists campagne_ads_metriche_unica
  on public.campagne_ads_metriche (campagna_id, data);

alter table public.campagne_ads_metriche enable row level security;

create policy campagne_ads_metriche_superadmin_all
  on public.campagne_ads_metriche
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 3) Vista riepilogo per campagna (totali + CTR + costo per conversione)
-- ---------------------------------------------------------
create or replace view public.v_campagne_ads_riepilogo
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.piattaforma,
  c.stato,
  c.landing_page_id,
  coalesce(sum(m.impressioni), 0) as impressioni_totali,
  coalesce(sum(m.click), 0) as click_totali,
  coalesce(sum(m.conversioni), 0) as conversioni_totali,
  coalesce(sum(m.spesa), 0) as spesa_totale,
  case when coalesce(sum(m.impressioni), 0) > 0
    then round((sum(m.click)::numeric / sum(m.impressioni)) * 100, 2)
    else null
  end as ctr_percentuale,
  case when coalesce(sum(m.conversioni), 0) > 0
    then round(sum(m.spesa) / sum(m.conversioni), 2)
    else null
  end as costo_per_conversione
from public.campagne_ads c
left join public.campagne_ads_metriche m on m.campagna_id = c.id
group by c.id, c.nome, c.piattaforma, c.stato, c.landing_page_id;

-- ---------------------------------------------------------
-- Nota
-- ---------------------------------------------------------
-- Questa migrazione NON integra le API di Google Ads / Meta Ads / TikTok Ads:
-- servono account pubblicitari attivi e credenziali API per automatizzare
-- creazione campagne e import metriche. Per ora la gestione è manuale
-- (creazione campagna + URL con UTM generato, inserimento metriche a mano
-- copiandole dalla dashboard della piattaforma).
insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'go_to_market',
  'Campagne Ads: gestione manuale, integrazione API in futuro',
  'Creata l''area per gestire campagne e metriche, collegata alle landing page. Nessuna integrazione diretta con Google Ads/Meta Ads API in questa fase: servono account pubblicitari attivi e credenziali. Quando si integrerà, l''architettura (riferimento_esterno_id, fonte=api) è già predisposta per import automatico.',
  'media', 'implementata'
);
