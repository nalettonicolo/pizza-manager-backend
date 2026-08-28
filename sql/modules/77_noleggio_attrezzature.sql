-- Modulo 77 — Noleggio operativo attrezzature + pagamenti a rate
--
-- Origine: handoff sessione Claude mobile (mod 52), riscritto per lo schema reale
-- (admin.tenants, public.utenti_ruoli — vedi note in 76_tenant_documenti_firma.sql).
-- Da applicare DOPO il modulo 76 (estende tenant_documenti con il tipo 'addendum_noleggio').
-- Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Catalogo attrezzature noleggiabili
-- ---------------------------------------------------------
create table if not exists public.attrezzature_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descrizione text,
  categoria text not null check (categoria in (
    'tablet', 'stampante', 'pos', 'router', 'lettore_barcode', 'kit_completo', 'altro'
  )),
  prezzo_acquisto numeric(10,2),
  canone_noleggio_mensile numeric(10,2) not null,
  cauzione numeric(10,2) default 0,
  disponibile boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.attrezzature_catalogo is
  'Catalogo delle attrezzature disponibili per il noleggio operativo (tablet, stampanti, POS...). Gestito da superadmin.';

alter table public.attrezzature_catalogo enable row level security;

create policy attrezzature_catalogo_superadmin_all
  on public.attrezzature_catalogo
  for all
  using (
    exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
      and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin'))
  )
  with check (
    exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
      and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin'))
  );

-- Il tenant admin può solo leggere il catalogo disponibile, per scegliere cosa noleggiare
create policy attrezzature_catalogo_tenant_select
  on public.attrezzature_catalogo
  for select
  using (disponibile = true);

-- ---------------------------------------------------------
-- 2) Noleggi attivi/storici per tenant
-- ---------------------------------------------------------
create table if not exists public.tenant_noleggi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references admin.tenants(id) on delete cascade,
  stato text not null default 'in_attesa' check (stato in (
    'in_attesa', 'attivo', 'sospeso', 'concluso', 'annullato'
  )),
  elenco_attrezzature text not null,      -- riepilogo leggibile (o jsonb se preferisci righe strutturate)
  quantita_totale integer default 1,
  canone_mensile numeric(10,2) not null,
  cauzione numeric(10,2) default 0,
  data_inizio date,
  data_fine date,
  termine_restituzione_giorni integer default 15,
  termini_manutenzione text,
  provider_pagamento text not null default 'bonifico' check (provider_pagamento in (
    'bonifico', 'sepa', 'carta', 'klarna', 'scalapay', 'soisy', 'altro_rateale'
  )),
  provider_riferimento_esterno text,       -- id ordine/contratto lato Klarna o altro provider
  numero_rate integer,                     -- se pagamento rateale
  importo_rata numeric(10,2),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.tenant_noleggi is
  'Noleggio operativo delle attrezzature per un tenant: canone, cauzione, eventuale finanziamento a rate tramite provider terzo (Klarna o equivalente).';

create index if not exists tenant_noleggi_tenant_idx
  on public.tenant_noleggi (tenant_id, stato, created_at desc);

alter table public.tenant_noleggi enable row level security;

create policy tenant_noleggi_superadmin_all
  on public.tenant_noleggi
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

create policy tenant_noleggi_tenant_admin_select
  on public.tenant_noleggi
  for select
  using (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and ur.tenant_id = tenant_noleggi.tenant_id
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
    )
  );

-- Il tenant admin può creare una richiesta di noleggio (stato 'in_attesa'),
-- l'attivazione a 'attivo' resta a superadmin dopo verifica/pagamento
create policy tenant_noleggi_tenant_admin_insert
  on public.tenant_noleggi
  for insert
  with check (
    stato = 'in_attesa'
    and exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and ur.tenant_id = tenant_noleggi.tenant_id
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
    )
  );

-- ---------------------------------------------------------
-- 3) Rate di pagamento — tracciamento generico, indipendente dal provider
-- ---------------------------------------------------------
-- NB: questa tabella registra SOLO lo stato delle rate ai fini gestionali/contabili.
-- L'incasso effettivo e la logica di finanziamento restano lato provider
-- (Klarna, Scalapay, ecc.): qui si salvano gli esiti ricevuti via webhook.
create table if not exists public.tenant_noleggi_rate (
  id uuid primary key default gen_random_uuid(),
  noleggio_id uuid not null references public.tenant_noleggi(id) on delete cascade,
  numero_rata integer not null,
  importo numeric(10,2) not null,
  scadenza date,
  stato text not null default 'programmata' check (stato in (
    'programmata', 'pagata', 'in_ritardo', 'fallita', 'rimborsata'
  )),
  provider_evento_id text,     -- id evento/webhook del provider, per idempotenza
  pagata_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tenant_noleggi_rate_evento_unique
  on public.tenant_noleggi_rate (provider_evento_id)
  where provider_evento_id is not null;

create index if not exists tenant_noleggi_rate_noleggio_idx
  on public.tenant_noleggi_rate (noleggio_id, numero_rata);

alter table public.tenant_noleggi_rate enable row level security;

create policy tenant_noleggi_rate_superadmin_all
  on public.tenant_noleggi_rate
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

create policy tenant_noleggi_rate_tenant_select
  on public.tenant_noleggi_rate
  for select
  using (
    exists (
      select 1 from public.tenant_noleggi n
      join public.utenti_ruoli ur on ur.tenant_id = n.tenant_id
      where n.id = tenant_noleggi_rate.noleggio_id
        and ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
    )
  );

-- ---------------------------------------------------------
-- 4) Estendere i tipi di documento generabili (modulo 76) con l'addendum
-- ---------------------------------------------------------
alter table public.tenant_documenti drop constraint if exists tenant_documenti_tipo_documento_check;
alter table public.tenant_documenti add constraint tenant_documenti_tipo_documento_check
  check (tipo_documento in (
    'termini_servizio', 'privacy_policy', 'contratto_abbonamento', 'dpa', 'addendum_noleggio'
  ));

-- ---------------------------------------------------------
-- Nota sull'integrazione con provider di pagamento a rate (Klarna e simili)
-- ---------------------------------------------------------
-- Questa migrazione NON include chiamate API a Klarna/Scalapay/altri: richiedono
-- un account merchant dedicato, credenziali API e gestione webhook lato Edge Function.
-- Schema pensato per essere provider-agnostic:
--   1. Al momento del noleggio, se provider_pagamento è rateale, si crea l'ordine
--      lato provider (Edge Function dedicata, es. `noleggio-crea-ordine-pagamento`)
--      e si salva l'id restituito in `provider_riferimento_esterno`.
--   2. Il provider notifica via webhook gli esiti delle singole rate: un'altra
--      Edge Function (es. `webhook-pagamenti-rateali`) verifica la firma del
--      webhook e aggiorna `tenant_noleggi_rate` di conseguenza.
--   3. `provider_evento_id` garantisce idempotenza in caso di webhook duplicati.
