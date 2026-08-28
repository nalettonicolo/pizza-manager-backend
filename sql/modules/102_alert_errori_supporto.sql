-- Modulo 102 — Alert email al supporto per errori nei tenant operativi
--
-- Richiesta esplicita: "Voglio che se ci sono errori nei tenant operativi mi arrivi una mail
-- automatica ad una mail che poi segno come support" — copertura scelta dall'utente: fallimenti
-- critici backend (pagamenti, edge function), errori JS lato client, ed errori applicativi minori
-- non gestiti altrove.
--
-- Architettura:
-- 1) public.log_errori_operativi   — ogni errore registrato per tenant (dedup 15 min + cap 200
--    righe non notificate per tenant, per evitare flooding da loop o abusi).
-- 2) public.pm_registra_errore_operativo(...)  — RPC SECURITY DEFINER, chiamabile da client
--    (anon/authenticated, per errori frontend) e da service_role (edge function), che scrive lì.
-- 3) public.piattaforma_alert_configurazione   — singleton con l'email di supporto e un
--    interruttore attivo/disattivo (di default disattivo finché il superadmin non imposta l'email
--    dalla pagina "Azioni da completare").
-- 4) public.pm_processa_digest_errori_supporto()  — invece di un'email per ogni singolo errore
--    (rumore ingestibile), raggruppa periodicamente gli errori non ancora notificati per tenant e
--    accoda UNA email di riepilogo su notifiche_outbox (già schedulato/consegnato dal worker
--    notifiche-outbox-processor esistente, via SMTP configurato dal superadmin).
-- 5) cron.schedule ogni 15 minuti — nessuna nuova Edge Function necessaria: la funzione di digest
--    è pura logica SQL, pg_cron la chiama direttamente nel database.
--
-- Copertura nota (vedi commit): instrumentati i punti a più alto rischio economico (rimborsi e
-- webhook Stripe) più un listener globale window.onerror/unhandledrejection lato frontend. Non è
-- ancora instrumentato ogni singolo catch-block del codebase: è un'infrastruttura estendibile,
-- non un'iniezione automatica in tutto il codice esistente.

-- ============================================================================
-- 1) Log errori operativi
-- ============================================================================
create table if not exists public.log_errori_operativi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
  origine text not null,
  gravita text not null default 'medio' check (gravita in ('critico', 'medio', 'basso')),
  messaggio text not null,
  dettaglio jsonb not null default '{}'::jsonb,
  occorrenze integer not null default 1,
  creato_il timestamptz not null default now(),
  notificato_il timestamptz
);

comment on table public.log_errori_operativi is
  'Log errori operativi per tenant (pagamenti falliti, edge function in errore, eccezioni frontend). Alimentato da pm_registra_errore_operativo(); digest periodico via pm_processa_digest_errori_supporto() accoda una email di riepilogo su notifiche_outbox.';

create index if not exists idx_log_errori_operativi_non_notificati
  on public.log_errori_operativi (tenant_id, creato_il)
  where notificato_il is null;

create index if not exists idx_log_errori_operativi_dedup
  on public.log_errori_operativi (tenant_id, origine, messaggio, creato_il)
  where notificato_il is null;

alter table public.log_errori_operativi enable row level security;

drop policy if exists log_errori_operativi_superadmin_select on public.log_errori_operativi;
create policy log_errori_operativi_superadmin_select
  on public.log_errori_operativi
  for select
  using (exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = (select auth.uid())
      and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ));

-- Nessuna policy insert/update/delete per authenticated/anon: la scrittura passa solo dalla RPC
-- SECURITY DEFINER qui sotto (che applica dedup/cap) o dal service_role (bypassa RLS).
grant select on public.log_errori_operativi to authenticated;
grant select, insert, update, delete on public.log_errori_operativi to service_role;

-- ============================================================================
-- 2) RPC di registrazione errore (dedup 15 min, cap 200 righe non notificate/tenant)
-- ============================================================================
create or replace function public.pm_registra_errore_operativo(
  p_tenant_id uuid,
  p_origine text,
  p_messaggio text,
  p_gravita text default 'critico',
  p_dettaglio jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, core, pg_temp
as $$
declare
  v_id uuid;
  v_gravita text;
  v_origine text;
  v_messaggio text;
  v_esistente_id uuid;
  v_conteggio_non_notificati integer;
begin
  if p_tenant_id is null then
    return null;
  end if;

  v_origine := left(coalesce(trim(p_origine), 'sconosciuta'), 200);
  v_messaggio := left(coalesce(trim(p_messaggio), ''), 2000);
  v_gravita := lower(coalesce(trim(p_gravita), 'critico'));
  if v_gravita not in ('critico', 'medio', 'basso') then
    v_gravita := 'medio';
  end if;

  if v_messaggio = '' then
    return null;
  end if;

  if not exists (select 1 from core.tenants where id = p_tenant_id) then
    return null;
  end if;

  select id into v_esistente_id
  from public.log_errori_operativi
  where tenant_id = p_tenant_id
    and origine = v_origine
    and messaggio = v_messaggio
    and notificato_il is null
    and creato_il > now() - interval '15 minutes'
  order by creato_il desc
  limit 1;

  if v_esistente_id is not null then
    update public.log_errori_operativi
    set occorrenze = occorrenze + 1
    where id = v_esistente_id;
    return v_esistente_id;
  end if;

  select count(*) into v_conteggio_non_notificati
  from public.log_errori_operativi
  where tenant_id = p_tenant_id and notificato_il is null;

  if v_conteggio_non_notificati >= 200 then
    return null;
  end if;

  insert into public.log_errori_operativi (tenant_id, origine, gravita, messaggio, dettaglio)
  values (p_tenant_id, v_origine, v_gravita, v_messaggio, coalesce(p_dettaglio, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.pm_registra_errore_operativo(uuid, text, text, text, jsonb) is
  'Registra un errore operativo di un tenant (dedup 15 min per tenant+origine+messaggio, cap 200 righe non notificate per tenant). Ritorna null su input non validi invece di sollevare eccezione: non deve mai rompere il flusso del chiamante.';

grant execute on function public.pm_registra_errore_operativo(uuid, text, text, text, jsonb) to anon, authenticated, service_role;

-- ============================================================================
-- 3) Configurazione email di supporto (singleton, superadmin-only)
-- ============================================================================
create table if not exists public.piattaforma_alert_configurazione (
  id uuid primary key default gen_random_uuid(),
  email_supporto text,
  attivo boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.piattaforma_alert_configurazione is
  'Configurazione unica per gli alert email al supporto quando si verificano errori nei tenant operativi. Disattiva di default finché il superadmin non imposta email_supporto e attiva dalla pagina "Azioni da completare".';

create unique index if not exists piattaforma_alert_configurazione_singleton
  on public.piattaforma_alert_configurazione ((true));

insert into public.piattaforma_alert_configurazione (email_supporto, attivo)
select null, false
where not exists (select 1 from public.piattaforma_alert_configurazione);

alter table public.piattaforma_alert_configurazione enable row level security;

drop policy if exists piattaforma_alert_configurazione_superadmin_all on public.piattaforma_alert_configurazione;
create policy piattaforma_alert_configurazione_superadmin_all
  on public.piattaforma_alert_configurazione
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

grant select on public.piattaforma_alert_configurazione to authenticated;
grant select, insert, update on public.piattaforma_alert_configurazione to service_role;

create or replace function public.pm_get_alert_configurazione()
returns table (email_supporto text, attivo boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = auth.uid() and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ) then
    raise exception 'Permesso negato';
  end if;

  return query
  select pac.email_supporto, pac.attivo, pac.updated_at
  from public.piattaforma_alert_configurazione pac
  limit 1;
end;
$$;

grant execute on function public.pm_get_alert_configurazione() to authenticated;

create or replace function public.pm_set_alert_configurazione(p_email text, p_attivo boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = auth.uid() and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ) then
    raise exception 'Permesso negato';
  end if;

  update public.piattaforma_alert_configurazione
  set email_supporto = nullif(trim(coalesce(p_email, '')), ''),
      attivo = coalesce(p_attivo, false),
      updated_at = now(),
      updated_by = auth.uid();

  if not found then
    insert into public.piattaforma_alert_configurazione (email_supporto, attivo, updated_by)
    values (nullif(trim(coalesce(p_email, '')), ''), coalesce(p_attivo, false), auth.uid());
  end if;
end;
$$;

grant execute on function public.pm_set_alert_configurazione(text, boolean) to authenticated;

-- ============================================================================
-- 4) Digest periodico → notifiche_outbox
-- ============================================================================
create or replace function public.pm_processa_digest_errori_supporto()
returns integer
language plpgsql
security definer
set search_path = public, core, pg_temp
as $$
declare
  v_email text;
  v_attivo boolean;
  v_cutoff timestamptz := clock_timestamp();
  v_gruppo record;
  v_dettaglio_righe text;
  v_oggetto text;
  v_count integer := 0;
begin
  select email_supporto, attivo into v_email, v_attivo
  from public.piattaforma_alert_configurazione
  limit 1;

  if coalesce(v_attivo, false) is not true or coalesce(trim(v_email), '') = '' then
    return 0;
  end if;

  for v_gruppo in
    select tenant_id, count(*) as n_errori
    from public.log_errori_operativi
    where notificato_il is null and creato_il <= v_cutoff
    group by tenant_id
  loop
    select string_agg(
      format('- [%s] (%s) %s — x%s — %s',
        gravita, origine, messaggio, occorrenze, to_char(creato_il, 'DD/MM HH24:MI')),
      E'\n' order by creato_il desc
    )
    into v_dettaglio_righe
    from public.log_errori_operativi
    where notificato_il is null and creato_il <= v_cutoff and tenant_id = v_gruppo.tenant_id;

    v_oggetto := format('⚠️ %s errori operativi rilevati — tenant %s', v_gruppo.n_errori, v_gruppo.tenant_id);

    insert into public.notifiche_outbox (tenant_id, tipo, destinatario, payload)
    values (
      v_gruppo.tenant_id,
      'alert_errore_supporto',
      v_email,
      jsonb_build_object(
        'oggetto', v_oggetto,
        'body', format(
          'Rilevati %s errori operativi negli ultimi minuti per il tenant %s.' || E'\n\n' || '%s',
          v_gruppo.n_errori, v_gruppo.tenant_id, v_dettaglio_righe
        )
      )
    );

    v_count := v_count + 1;
  end loop;

  update public.log_errori_operativi
  set notificato_il = now()
  where notificato_il is null and creato_il <= v_cutoff;

  return v_count;
end;
$$;

comment on function public.pm_processa_digest_errori_supporto() is
  'Job periodico (pg_cron, ogni 15 min): raggruppa gli errori non ancora notificati per tenant e accoda UNA email di riepilogo per tenant su notifiche_outbox (consegnata dal worker notifiche-outbox-processor già schedulato). No-op se l''alert non è attivo o l''email di supporto non è impostata.';

-- service_role la esegue via cron; nessun grant a client necessario.
grant execute on function public.pm_processa_digest_errori_supporto() to service_role;

-- ============================================================================
-- 5) Scheduling pg_cron
-- ============================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'alert-errori-digest-supporto',
  '*/15 * * * *',
  $$select public.pm_processa_digest_errori_supporto();$$
);
