-- Modulo 83 — Agente AI unico (marketing + supporto tenant): configurazione, conversazioni
--
-- Origine: handoff sessione Claude mobile (mod 58), riscritto per lo schema reale
-- (admin.tenants invece di public.tenants, public.utenti_ruoli invece di
-- public.profiles.is_superadmin/tenant_id — vedi note in 76_tenant_documenti_firma.sql).
-- Indipendente da 81/82, dipende dal modulo 79 (faq_pubbliche) per il contesto marketing.
-- Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Configurazione dell'agente (riga singola, editabile da superadmin)
-- ---------------------------------------------------------
create table if not exists public.agente_configurazione (
  id uuid primary key default gen_random_uuid(),
  modello text not null default 'claude-sonnet-4-5-20250929', -- verificare su console.anthropic.com prima del go-live
  system_prompt_marketing text not null default
    'Sei l''assistente virtuale del sito PizzaManager, una piattaforma gestionale per pizzerie. Rispondi in italiano, in modo diretto e cordiale, basandoti solo sulle informazioni fornite nel contesto. Se non sai una risposta, invita a contattare l''assistenza invece di inventare dettagli su prezzi o funzionalità.',
  system_prompt_supporto text not null default
    'Sei l''assistente di supporto per i clienti PizzaManager già registrati. Rispondi in italiano, in modo pratico e operativo, aiutando l''utente a usare la piattaforma (cassa, comande, delivery, magazzino, fidelity, contabilità). Se la richiesta riguarda un problema tecnico che non puoi risolvere via chat, invita a contattare l''assistenza umana. Non rivelare mai dati di altri tenant.',
  temperatura numeric(2,1) default 0.3,
  max_token_risposta integer default 800,
  attivo boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.agente_configurazione is
  'Configurazione unica dell''agente AI (prompt di sistema per modalità marketing/supporto, modello, parametri). Modificabile solo da superadmin.';

create unique index if not exists agente_configurazione_singleton on public.agente_configurazione ((true));

alter table public.agente_configurazione enable row level security;

create policy agente_configurazione_superadmin_all
  on public.agente_configurazione
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

insert into public.agente_configurazione (attivo) values (false)
on conflict do nothing;

-- ---------------------------------------------------------
-- 2) Conversazioni — sia visitatori anonimi (marketing) sia tenant loggati (supporto)
-- ---------------------------------------------------------
create table if not exists public.agente_conversazioni (
  id uuid primary key default gen_random_uuid(),
  sessione_id text not null,          -- id di sessione lato client, per raggruppare i messaggi
  modalita text not null check (modalita in ('marketing', 'supporto')),
  tenant_id uuid references admin.tenants(id) on delete set null, -- solo per modalita = 'supporto'
  utente_id uuid references auth.users(id),                        -- solo per modalita = 'supporto'
  messaggi jsonb not null default '[]'::jsonb, -- [{role: 'user'|'assistant', content: '...', at: iso}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agente_conversazioni is
  'Storico delle conversazioni con l''agente AI, sia dal sito pubblico (marketing) sia dall''app tenant (supporto).';

create index if not exists agente_conversazioni_sessione_idx on public.agente_conversazioni (sessione_id);
create index if not exists agente_conversazioni_tenant_idx on public.agente_conversazioni (tenant_id, created_at desc);

alter table public.agente_conversazioni enable row level security;

-- Superadmin: accesso completo (per revisione/qualità delle risposte)
create policy agente_conversazioni_superadmin_all
  on public.agente_conversazioni
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- Tenant: può vedere/scrivere solo le proprie conversazioni di supporto
-- (qualunque ruolo attivo sul tenant, non solo admin: il supporto serve a tutto lo staff)
create policy agente_conversazioni_tenant_own
  on public.agente_conversazioni
  for all
  using (
    modalita = 'supporto'
    and tenant_id in (
      select ur.tenant_id from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid()) and coalesce(ur.attivo, true) = true
    )
  )
  with check (
    modalita = 'supporto'
    and tenant_id in (
      select ur.tenant_id from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid()) and coalesce(ur.attivo, true) = true
    )
  );

-- Nota: le conversazioni 'marketing' da visitatori anonimi vengono scritte
-- dalla Edge Function con service role key (nessun utente autenticato),
-- quindi non serve una policy pubblica di insert lato client.
