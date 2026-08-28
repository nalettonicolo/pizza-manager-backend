-- Modulo 94 — Calibrazione settimanale AI dei tempi di attesa (Piano B)
--
-- L'AI non decide mai da sola sui parametri di capacità forno (pizze_ogni_15_min, lo stesso
-- parametro già usato da assert_slot_capacity_for_ordine per bloccare gli slot pieni). Ogni
-- settimana calcola una PROPOSTA (mai applicata in automatico), la notifica al superadmin (per
-- conoscenza) e all'admin del tenant (email + popup in app, anche in Cassa se autorizzato), e
-- resta in attesa finché un umano autorizzato non la approva o la rifiuta esplicitamente.
-- Snapshot completo dei parametri salvato ad ogni proposta, per poter tornare indietro anche
-- dopo l'approvazione.
--
-- Vedi anche sql/modules/93_stima_tempo_attesa_agente_cliente.sql (stessa capacità forno, usata
-- lì per la stima "a che ora" senza creare un ordine) e
-- supabase/functions/ricalibra-tempi-attesa/index.ts (job settimanale che chiama la funzione di
-- analisi sotto e crea la proposta).
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nomi migrazione: calibrazione_tempi_ai_schema,
-- fix_pm_valuta_calibrazione_no_ddl — il secondo corregge un CREATE TEMP TABLE non ammesso in
-- una funzione STABLE, sostituito con una CTE pura).

create table if not exists public.agente_calibrazione_proposte (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references admin.tenants(id) on delete cascade,
  parametro text not null default 'pizze_ogni_15_min',
  valore_attuale numeric not null,
  valore_proposto numeric not null,
  motivo text not null,
  statistiche jsonb not null default '{}'::jsonb,
  backup_parametri_operativi jsonb not null,
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'approvata', 'rifiutata', 'ripristinata', 'scaduta')),
  periodo_da date not null,
  periodo_a date not null,
  creato_il timestamptz not null default now(),
  decisa_il timestamptz,
  decisa_da uuid references auth.users(id),
  notifiche_accodate boolean not null default false
);

comment on table public.agente_calibrazione_proposte is
  'Proposte settimanali dell''AI per ricalibrare parametri operativi sensibili (es. capacità forno). Mai applicate in automatico: restano "in_attesa" finché un admin/cassa autorizzato non le approva o rifiuta dal popup dedicato. backup_parametri_operativi permette il ripristino anche dopo l''approvazione.';

create index if not exists agente_calibrazione_proposte_tenant_stato_idx
  on public.agente_calibrazione_proposte (tenant_id, stato, creato_il desc);

alter table public.agente_calibrazione_proposte enable row level security;

create policy agente_calibrazione_proposte_superadmin_all
  on public.agente_calibrazione_proposte
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- Tenant: lettura per chiunque abbia un ruolo attivo su quel tenant (Admin e Cassa devono vederla,
-- come richiesto); nessun UPDATE/DELETE diretto da qui — solo tramite le RPC sotto, che verificano
-- il permesso puo_modificare_parametri prima di scrivere.
create policy agente_calibrazione_proposte_tenant_select
  on public.agente_calibrazione_proposte
  for select
  using (
    tenant_id in (
      select ur.tenant_id from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid()) and coalesce(ur.attivo, true) = true
    )
  );

-- ---------------------------------------------------------
-- Analisi settimanale (sola lettura): saturazione degli slot di punta negli ultimi 7 giorni,
-- confrontata col tetto attuale (parametri_operativi.pizze_ogni_15_min). Non scrive nulla: dice
-- solo se conviene proporre un cambiamento, con quale valore e perché — stessa metrica usata da
-- assert_slot_capacity_for_ordine per restare coerente con cosa succede davvero in cassa.
create or replace function public.pm_valuta_calibrazione_settimanale(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, core, admin
as $$
declare
  v_po jsonb;
  v_max numeric;
  v_n_slot_totali int;
  v_n_top int;
  v_pizze_medie_top numeric;
  v_tasso numeric;
  v_valore_proposto numeric;
  v_motivo text;
begin
  select t.parametri_operativi into v_po from admin.tenants t where t.id = p_tenant_id;
  v_po := coalesce(v_po, '{}'::jsonb);
  v_max := greatest(1, round(coalesce((v_po->>'pizze_ogni_15_min')::numeric, 8)));

  with slot_pizze as (
    select
      (o.created_at at time zone 'Europe/Rome')::date as giorno,
      public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) as slot_key,
      sum(ro.quantita) as pizze
    from core.ordini o
    join core.riga_ordine ro on ro.ordine_id = o.id and ro.tenant_id = o.tenant_id
    where o.tenant_id = p_tenant_id
      and o.stato::text not in ('ANNULLATO')
      and o.created_at >= now() - interval '7 days'
      and o.orario_ritiro is not null
    group by 1, 2
  ),
  conteggio as (
    select count(*)::int as n_totali from slot_pizze
  ),
  top_slots as (
    select pizze from slot_pizze
    order by pizze desc
    limit greatest(5, (select n_totali from conteggio) / 5)
  )
  select
    (select n_totali from conteggio),
    (select avg(pizze) from top_slots),
    (select count(*)::int from top_slots)
  into v_n_slot_totali, v_pizze_medie_top, v_n_top;

  if v_n_slot_totali is null or v_n_slot_totali < 10 then
    return jsonb_build_object(
      'proponi', false,
      'motivo_no_proposta', 'Troppo pochi dati questa settimana per una proposta affidabile.',
      'n_slot_totali', coalesce(v_n_slot_totali, 0)
    );
  end if;

  v_tasso := round(v_pizze_medie_top / v_max, 3);

  if v_tasso >= 0.9 then
    v_valore_proposto := ceil(v_max * 1.15);
    v_motivo := format(
      'Nelle ore di punta di questa settimana il forno ha raggiunto in media il %s%% della capacità dichiarata (%s pizze/15min). Se pensi che il forno possa gestirne di più, valuta di alzare il limite a %s: meno slot rifiutati ai clienti.',
      round(v_tasso * 100), v_max, v_valore_proposto
    );
  elsif v_tasso <= 0.5 then
    v_valore_proposto := greatest(4, floor(v_max * 0.9));
    v_motivo := format(
      'Anche nelle ore di punta di questa settimana il forno è rimasto in media al %s%% della capacità dichiarata (%s pizze/15min): ampio margine inutilizzato. Puoi stringere leggermente a %s se preferisci ordini più concentrati, oppure lasciare invariato.',
      round(v_tasso * 100), v_max, v_valore_proposto
    );
  else
    return jsonb_build_object(
      'proponi', false,
      'motivo_no_proposta', 'Il limite attuale sembra adeguato al carico osservato questa settimana.',
      'tasso_saturazione', v_tasso,
      'n_slot_totali', v_n_slot_totali
    );
  end if;

  if v_valore_proposto = v_max then
    return jsonb_build_object(
      'proponi', false,
      'motivo_no_proposta', 'Il valore calcolato coincide con quello attuale.',
      'tasso_saturazione', v_tasso
    );
  end if;

  return jsonb_build_object(
    'proponi', true,
    'valore_attuale', v_max,
    'valore_proposto', v_valore_proposto,
    'motivo', v_motivo,
    'statistiche', jsonb_build_object(
      'tasso_saturazione_ore_punta', v_tasso,
      'n_slot_totali_settimana', v_n_slot_totali,
      'n_slot_analizzati_punta', v_n_top,
      'pizze_medie_slot_punta', round(v_pizze_medie_top, 1)
    )
  );
end;
$$;

comment on function public.pm_valuta_calibrazione_settimanale(uuid) is
  'Sola lettura: calcola se conviene proporre un nuovo pizze_ogni_15_min in base alla saturazione delle ore di punta negli ultimi 7 giorni. Non scrive nulla — chiamata dal job settimanale ricalibra-tempi-attesa, che decide se creare la riga in agente_calibrazione_proposte.';

-- ---------------------------------------------------------
-- Decisione umana: approva, rifiuta, ripristina. Solo chi ha ruolo admin sul tenant o il
-- permesso puo_modificare_parametri (stesso permesso già usato per i parametri cassa).
create or replace function public.pm_puo_decidere_calibrazione(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, core, admin
as $$
  select exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = p_tenant_id
      and coalesce(ur.attivo, true) = true
      and (lower(trim(coalesce(ur.ruolo, ''))) = 'admin' or coalesce(ur.puo_modificare_parametri, false) = true)
  );
$$;

create or replace function public.pm_applica_calibrazione_proposta(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = public, core, admin
as $$
declare
  v_row public.agente_calibrazione_proposte%rowtype;
  v_po jsonb;
begin
  select * into v_row from public.agente_calibrazione_proposte where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_non_trovata';
  end if;
  if not public.pm_puo_decidere_calibrazione(v_row.tenant_id) then
    raise exception 'non_autorizzato';
  end if;
  if v_row.stato <> 'in_attesa' then
    raise exception 'proposta_gia_decisa';
  end if;

  select parametri_operativi into v_po from admin.tenants where id = v_row.tenant_id;
  v_po := coalesce(v_po, '{}'::jsonb) || jsonb_build_object(v_row.parametro, v_row.valore_proposto);
  update admin.tenants set parametri_operativi = v_po, updated_at = now() where id = v_row.tenant_id;

  update public.agente_calibrazione_proposte
  set stato = 'approvata', decisa_il = now(), decisa_da = auth.uid()
  where id = p_proposta_id;
end;
$$;

create or replace function public.pm_rifiuta_calibrazione_proposta(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = public, core, admin
as $$
declare
  v_row public.agente_calibrazione_proposte%rowtype;
begin
  select * into v_row from public.agente_calibrazione_proposte where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_non_trovata';
  end if;
  if not public.pm_puo_decidere_calibrazione(v_row.tenant_id) then
    raise exception 'non_autorizzato';
  end if;
  if v_row.stato <> 'in_attesa' then
    raise exception 'proposta_gia_decisa';
  end if;

  update public.agente_calibrazione_proposte
  set stato = 'rifiutata', decisa_il = now(), decisa_da = auth.uid()
  where id = p_proposta_id;
end;
$$;

-- Ripristina SOLO il valore del parametro salvato nel backup al momento della proposta (non
-- l'intero jsonb: altre modifiche fatte nel frattempo ad altri parametri restano intatte).
create or replace function public.pm_ripristina_calibrazione_proposta(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = public, core, admin
as $$
declare
  v_row public.agente_calibrazione_proposte%rowtype;
  v_po jsonb;
  v_valore_originale numeric;
begin
  select * into v_row from public.agente_calibrazione_proposte where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_non_trovata';
  end if;
  if not public.pm_puo_decidere_calibrazione(v_row.tenant_id) then
    raise exception 'non_autorizzato';
  end if;
  if v_row.stato <> 'approvata' then
    raise exception 'proposta_non_approvata';
  end if;

  v_valore_originale := (v_row.backup_parametri_operativi->>v_row.parametro)::numeric;
  if v_valore_originale is null then
    raise exception 'valore_originale_non_disponibile';
  end if;

  select parametri_operativi into v_po from admin.tenants where id = v_row.tenant_id;
  v_po := coalesce(v_po, '{}'::jsonb) || jsonb_build_object(v_row.parametro, v_valore_originale);
  update admin.tenants set parametri_operativi = v_po, updated_at = now() where id = v_row.tenant_id;

  update public.agente_calibrazione_proposte
  set stato = 'ripristinata', decisa_il = now(), decisa_da = auth.uid()
  where id = p_proposta_id;
end;
$$;

grant execute on function public.pm_valuta_calibrazione_settimanale(uuid) to service_role;
grant execute on function public.pm_puo_decidere_calibrazione(uuid) to authenticated;
grant execute on function public.pm_applica_calibrazione_proposta(uuid) to authenticated;
grant execute on function public.pm_rifiuta_calibrazione_proposta(uuid) to authenticated;
grant execute on function public.pm_ripristina_calibrazione_proposta(uuid) to authenticated;
