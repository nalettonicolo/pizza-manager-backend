-- Modulo 76 — Documenti contrattuali precompilati (ToS/Privacy/Contratto/DPA) + firma tablet
--
-- Origine: handoff sessione Claude mobile (mod 51), riscritto per lo schema REALE verificato
-- il 2026-08-26 via Supabase MCP list_tables sul progetto flfhrwzlrftuhkrfwzse:
--   - la tabella tenant è admin.tenants (NON public.tenants, che non esiste)
--   - non esiste public.profiles (rimossa/mai esistita — vedi 71_fix_delivery_functions_dead_profiles_table.sql,
--     bug reale in produzione causato esattamente da questa assunzione sbagliata)
--   - ruolo/superadmin si leggono da public.utenti_ruoli (user_id, tenant_id, ruolo, attivo),
--     non da una colonna is_superadmin
--
-- Additivo, idempotente, nessun DROP/DELETE. Non ancora applicato al remoto: solo file locale
-- in attesa di revisione (vedi sql/modules/README.md per il workflow di apply).

-- ---------------------------------------------------------
-- 1) Dati fissi del Fornitore (PizzaManager) — riga singola
-- ---------------------------------------------------------
create table if not exists public.fornitore_config (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null,
  indirizzo text not null,
  piva text not null,
  legale_rappresentante text not null,
  email_contatto text not null,
  email_privacy text not null,
  foro_competente text not null,
  iban text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.fornitore_config is
  'Riga singola con i dati fissi di PizzaManager (Fornitore) usati per precompilare ToS, Privacy, Contratti. Modificabile solo da superadmin.';

-- vincolo "singleton": una sola riga ammessa
create unique index if not exists fornitore_config_singleton
  on public.fornitore_config ((true));

alter table public.fornitore_config enable row level security;

create policy fornitore_config_superadmin_all
  on public.fornitore_config
  for all
  using (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
    )
  );

-- ---------------------------------------------------------
-- 2) Documenti generati per tenant (bozze e firmati)
-- ---------------------------------------------------------
create table if not exists public.tenant_documenti (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references admin.tenants(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in (
    'termini_servizio', 'privacy_policy', 'contratto_abbonamento', 'dpa'
  )),
  stato text not null default 'bozza' check (stato in ('bozza', 'firmato', 'annullato')),
  dati_snapshot jsonb not null, -- copia dei dati fornitore+tenant al momento della generazione
  pdf_url text,                 -- path nello storage bucket 'contratti'
  firma_url text,               -- path immagine firma nello storage bucket 'contratti'
  firmato_da text,              -- nome di chi ha firmato (testo libero, non un utente auth)
  firmato_at timestamptz,
  ip_firma text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.tenant_documenti is
  'Storico dei documenti (ToS, Privacy, Contratto, DPA) generati e firmati per ciascun tenant.';

create index if not exists tenant_documenti_tenant_idx
  on public.tenant_documenti (tenant_id, tipo_documento, created_at desc);

alter table public.tenant_documenti enable row level security;

-- Superadmin: accesso completo
create policy tenant_documenti_superadmin_all
  on public.tenant_documenti
  for all
  using (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
    )
  );

-- Admin del tenant: può vedere e creare i documenti del proprio tenant
create policy tenant_documenti_tenant_admin_select
  on public.tenant_documenti
  for select
  using (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and ur.tenant_id = tenant_documenti.tenant_id
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
    )
  );

create policy tenant_documenti_tenant_admin_insert
  on public.tenant_documenti
  for insert
  with check (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and ur.tenant_id = tenant_documenti.tenant_id
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
    )
  );

-- Aggiornamento (es. per apporre la firma) consentito solo se il documento
-- è ancora in stato 'bozza', per non permettere modifiche a un firmato.
create policy tenant_documenti_tenant_admin_update
  on public.tenant_documenti
  for update
  using (
    stato = 'bozza'
    and exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and ur.tenant_id = tenant_documenti.tenant_id
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
    )
  );

-- ---------------------------------------------------------
-- 3) Storage bucket per PDF e firme
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contratti', 'contratti', false)
on conflict (id) do nothing;

-- Superadmin: accesso completo al bucket
create policy contratti_storage_superadmin
  on storage.objects
  for all
  using (
    bucket_id = 'contratti'
    and exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
    )
  );

-- Admin tenant: accesso solo ai file nel proprio "folder" (path prefissato con tenant_id/)
-- Convenzione: i file vanno salvati come `${tenant_id}/${documento_id}.pdf`
create policy contratti_storage_tenant_admin
  on storage.objects
  for all
  using (
    bucket_id = 'contratti'
    and exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid())
        and coalesce(ur.attivo, true) = true
        and lower(trim(coalesce(ur.ruolo, ''))) in ('admin', 'amministratore', 'gestore', 'owner')
        and (storage.foldername(name))[1] = ur.tenant_id::text
    )
  );

-- ---------------------------------------------------------
-- 4) Vista comoda: ultimo documento firmato per tipo, per tenant
-- ---------------------------------------------------------
create or replace view public.v_tenant_documenti_attuali
with (security_invoker = true) as
select distinct on (tenant_id, tipo_documento)
  id, tenant_id, tipo_documento, stato, pdf_url, firmato_da, firmato_at
from public.tenant_documenti
where stato = 'firmato'
order by tenant_id, tipo_documento, firmato_at desc;
