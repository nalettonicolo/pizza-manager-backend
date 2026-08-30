-- Modulo 113 — Registro attività: monitoraggio continuo (superadmin)
--
-- Estende public.log_richieste_sviluppo: chi ha fatto il lavoro, esito, branch/PR,
-- scrittura da superadmin (non solo service_role) e Realtime per la pagina
-- /superadmin/registro-attivita.

create table if not exists public.log_richieste_sviluppo (
  id uuid primary key default gen_random_uuid(),
  richiesta text not null,
  azioni text not null,
  area text,
  fonte text,
  stato text,
  branch text,
  pr_url text,
  creato_il timestamptz not null default now()
);

alter table public.log_richieste_sviluppo add column if not exists fonte text;
alter table public.log_richieste_sviluppo add column if not exists stato text;
alter table public.log_richieste_sviluppo add column if not exists branch text;
alter table public.log_richieste_sviluppo add column if not exists pr_url text;

comment on table public.log_richieste_sviluppo is
  'Registro cronologico richieste utente e azioni svolte (Cursor, Claude, note superadmin). Solo superadmin.';

comment on column public.log_richieste_sviluppo.fonte is
  'Origine della voce: cursor, claude, umano, sistema.';
comment on column public.log_richieste_sviluppo.stato is
  'Esito: completato, parziale, bloccato.';
comment on column public.log_richieste_sviluppo.branch is
  'Branch git collegato, se presente.';
comment on column public.log_richieste_sviluppo.pr_url is
  'URL della pull request, se presente.';

alter table public.log_richieste_sviluppo drop constraint if exists log_richieste_sviluppo_fonte_chk;
alter table public.log_richieste_sviluppo
  add constraint log_richieste_sviluppo_fonte_chk
  check (fonte is null or fonte in ('cursor', 'claude', 'umano', 'sistema'));

alter table public.log_richieste_sviluppo drop constraint if exists log_richieste_sviluppo_stato_chk;
alter table public.log_richieste_sviluppo
  add constraint log_richieste_sviluppo_stato_chk
  check (stato is null or stato in ('completato', 'parziale', 'bloccato'));

create index if not exists idx_log_richieste_sviluppo_creato_il
  on public.log_richieste_sviluppo (creato_il desc);

alter table public.log_richieste_sviluppo enable row level security;

drop policy if exists log_richieste_sviluppo_superadmin_select on public.log_richieste_sviluppo;
create policy log_richieste_sviluppo_superadmin_select
  on public.log_richieste_sviluppo
  for select
  using (public.pm_auth_is_superadmin());

drop policy if exists log_richieste_sviluppo_superadmin_insert on public.log_richieste_sviluppo;
create policy log_richieste_sviluppo_superadmin_insert
  on public.log_richieste_sviluppo
  for insert
  with check (public.pm_auth_is_superadmin());

drop policy if exists log_richieste_sviluppo_superadmin_update on public.log_richieste_sviluppo;
create policy log_richieste_sviluppo_superadmin_update
  on public.log_richieste_sviluppo
  for update
  using (public.pm_auth_is_superadmin())
  with check (public.pm_auth_is_superadmin());

drop policy if exists log_richieste_sviluppo_superadmin_delete on public.log_richieste_sviluppo;
create policy log_richieste_sviluppo_superadmin_delete
  on public.log_richieste_sviluppo
  for delete
  using (public.pm_auth_is_superadmin());

grant select, insert, update, delete on public.log_richieste_sviluppo to authenticated;
grant select, insert, update, delete on public.log_richieste_sviluppo to service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'log_richieste_sviluppo'
  ) then
    raise notice 'log_richieste_sviluppo già in supabase_realtime';
  else
    alter publication supabase_realtime add table public.log_richieste_sviluppo;
    raise notice 'log_richieste_sviluppo aggiunto a supabase_realtime';
  end if;
end;
$$;
