-- Modulo 106 — Configurazione generale piattaforma (nome applicazione + contatti supporto)
--
-- Bug trovato in audit dal vivo: Superadmin → Impostazioni → "Configurazione generale" era un
-- mockup non funzionante — campo "Nome applicazione" disabilitato con valore fisso, campi
-- "Supporto" senza alcun salvataggio, pulsante "Salva impostazioni" che impostava solo uno stato
-- locale ("Salvato (simulato)"). Reso reale: singleton leggibile pubblicamente (branding e
-- contatti mostrati ai clienti), scrivibile solo da superadmin.

create table if not exists public.piattaforma_configurazione_generale (
  id uuid primary key default gen_random_uuid(),
  nome_applicazione text not null default 'PizzaManager',
  email_supporto text,
  url_supporto text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.piattaforma_configurazione_generale is
  'Configurazione unica di branding/contatti mostrata ai clienti (nome applicazione, email e URL di supporto). Lettura pubblica, scrittura solo superadmin.';

create unique index if not exists piattaforma_configurazione_generale_singleton
  on public.piattaforma_configurazione_generale ((true));

insert into public.piattaforma_configurazione_generale (nome_applicazione, email_supporto, url_supporto)
select 'PizzaManager', 'support@pizzamanager.it', null
where not exists (select 1 from public.piattaforma_configurazione_generale);

alter table public.piattaforma_configurazione_generale enable row level security;

drop policy if exists piattaforma_configurazione_generale_public_select on public.piattaforma_configurazione_generale;
create policy piattaforma_configurazione_generale_public_select
  on public.piattaforma_configurazione_generale
  for select
  using (true);

drop policy if exists piattaforma_configurazione_generale_superadmin_write on public.piattaforma_configurazione_generale;
create policy piattaforma_configurazione_generale_superadmin_write
  on public.piattaforma_configurazione_generale
  for all
  using (exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = (select auth.uid())
      and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ))
  with check (exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = (select auth.uid())
      and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ));

grant select on public.piattaforma_configurazione_generale to anon, authenticated;
grant insert, update on public.piattaforma_configurazione_generale to authenticated;
grant select, insert, update on public.piattaforma_configurazione_generale to service_role;
