-- Modulo 107 — Registro richieste/azioni di sviluppo (visibile solo superadmin)
--
-- Richiesta esplicita dell'utente: un documento dentro il progetto, visibile solo da superadmin
-- online, con il riepilogo di ogni richiesta fatta e ogni azione svolta da Claude — per restare
-- sempre aggiornati senza dover riaprire la chat. Scrittura riservata a chi gestisce il progetto
-- (nessuna RPC di insert esposta al client: le righe vengono aggiunte direttamente via migration/
-- SQL da Claude dopo ogni richiesta significativa, coerente con come già lavora in questa sessione).

create table if not exists public.log_richieste_sviluppo (
  id uuid primary key default gen_random_uuid(),
  richiesta text not null,
  azioni text not null,
  area text,
  creato_il timestamptz not null default now()
);

comment on table public.log_richieste_sviluppo is
  'Registro cronologico di ogni richiesta dell''utente e delle azioni svolte da Claude sul progetto — visibile solo da superadmin, per restare sempre aggiornati senza riaprire la chat.';

create index if not exists idx_log_richieste_sviluppo_creato_il
  on public.log_richieste_sviluppo (creato_il desc);

alter table public.log_richieste_sviluppo enable row level security;

drop policy if exists log_richieste_sviluppo_superadmin_select on public.log_richieste_sviluppo;
create policy log_richieste_sviluppo_superadmin_select
  on public.log_richieste_sviluppo
  for select
  using (exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = (select auth.uid())
      and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ));

grant select on public.log_richieste_sviluppo to authenticated;
grant select, insert, update, delete on public.log_richieste_sviluppo to service_role;
