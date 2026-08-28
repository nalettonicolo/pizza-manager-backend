-- Modulo 98 — Quota/billing per l'agente AI in modalità 'cliente' (add-on a pagamento)
--
-- L'add-on AI per i clienti finali (discusso in chat: canone fisso mensile, tetto di richieste
-- incluse) tocca un costo reale variabile verso Anthropic. Questo modulo aggiunge il tracciamento
-- del consumo reale (token della risposta, mai stimati) e il tetto oltre cui l'agente smette di
-- chiamare il modello invece di generare un costo scoperto.
--
-- Solo la modalità 'cliente' è soggetta a quota: 'marketing' e 'supporto' sono PizzaManager
-- stesso che paga (il proprio sito, il proprio supporto clienti), non un costo per-tenant.
--
-- Vedi supabase/functions/agente-chat/index.ts (enforcement + registrazione) e
-- sql/modules/83_agente_ai_configurazione_conversazioni.sql (tabella agente_configurazione).
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nome migrazione: agente_quota_billing_cliente). Verificato con
-- una richiesta di test (500 token input, 150 output → costo stimato 0.0038€, coerente con i
-- prezzi di default sotto).

alter table public.agente_configurazione
  add column if not exists costo_input_per_milione_eur numeric(10,2) not null default 3.00,
  add column if not exists costo_output_per_milione_eur numeric(10,2) not null default 15.00;

comment on column public.agente_configurazione.costo_input_per_milione_eur is
  'Prezzo Anthropic per 1M token di input, in euro — DA VERIFICARE su console.anthropic.com/pricing prima di fidarsi del costo stimato: i prezzi cambiano nel tempo e variano per modello.';
comment on column public.agente_configurazione.costo_output_per_milione_eur is
  'Prezzo Anthropic per 1M token di output, in euro — stessa nota della colonna costo_input_per_milione_eur.';

create table if not exists public.agente_utilizzo_mensile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references admin.tenants(id) on delete cascade,
  periodo date not null, -- primo del mese (UTC)
  richieste_count integer not null default 0,
  token_input bigint not null default 0,
  token_output bigint not null default 0,
  costo_stimato_eur numeric(10,4) not null default 0,
  quota_superata boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (tenant_id, periodo)
);

comment on table public.agente_utilizzo_mensile is
  'Consumo mensile dell''agente AI (modalità cliente) per tenant — usata per il tetto di richieste incluse nel canone e per stimare il costo reale verso Anthropic.';

create index if not exists agente_utilizzo_mensile_tenant_periodo_idx
  on public.agente_utilizzo_mensile (tenant_id, periodo desc);

alter table public.agente_utilizzo_mensile enable row level security;

create policy agente_utilizzo_mensile_superadmin_all
  on public.agente_utilizzo_mensile
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

create policy agente_utilizzo_mensile_tenant_select
  on public.agente_utilizzo_mensile
  for select
  using (
    tenant_id in (
      select ur.tenant_id from public.utenti_ruoli ur
      where ur.user_id = (select auth.uid()) and coalesce(ur.attivo, true) = true
    )
  );

-- ---------------------------------------------------------
-- Quota inclusa nel canone: parametri_operativi.agente_quota_richieste_mese (default 400 se il
-- tenant non l'ha mai impostata — soglia generosa, il costo reale a quel volume resta minimo con
-- un modello economico, vedi conti in chat).
create or replace function public.pm_agente_quota_richieste(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, core, admin
as $$
  select greatest(1, coalesce((t.parametri_operativi->>'agente_quota_richieste_mese')::int, 400))
  from admin.tenants t
  where t.id = p_tenant_id;
$$;

create or replace function public.pm_agente_quota_superata(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, core, admin
as $$
  select coalesce(
    (
      select u.richieste_count >= public.pm_agente_quota_richieste(p_tenant_id)
      from public.agente_utilizzo_mensile u
      where u.tenant_id = p_tenant_id
        and u.periodo = date_trunc('month', now())::date
    ),
    false
  );
$$;

-- Registra una richiesta reale (chiamata SOLO dopo una risposta Anthropic riuscita, con i token
-- reali della risposta — mai stimati). SECURITY DEFINER + grant a service_role: solo l'Edge
-- Function scrive qui, mai il client.
create or replace function public.pm_agente_registra_utilizzo(
  p_tenant_id uuid,
  p_token_input integer,
  p_token_output integer
)
returns void
language plpgsql
security definer
set search_path = public, core, admin
as $$
declare
  v_periodo date := date_trunc('month', now())::date;
  v_costo_input numeric;
  v_costo_output numeric;
  v_quota integer;
begin
  select coalesce(costo_input_per_milione_eur, 3.00), coalesce(costo_output_per_milione_eur, 15.00)
  into v_costo_input, v_costo_output
  from public.agente_configurazione
  limit 1;

  v_quota := public.pm_agente_quota_richieste(p_tenant_id);

  insert into public.agente_utilizzo_mensile (tenant_id, periodo, richieste_count, token_input, token_output, costo_stimato_eur)
  values (
    p_tenant_id, v_periodo, 1, greatest(0, p_token_input), greatest(0, p_token_output),
    round((greatest(0, p_token_input) * v_costo_input + greatest(0, p_token_output) * v_costo_output) / 1000000.0, 4)
  )
  on conflict (tenant_id, periodo) do update set
    richieste_count = agente_utilizzo_mensile.richieste_count + 1,
    token_input = agente_utilizzo_mensile.token_input + greatest(0, p_token_input),
    token_output = agente_utilizzo_mensile.token_output + greatest(0, p_token_output),
    costo_stimato_eur = agente_utilizzo_mensile.costo_stimato_eur
      + round((greatest(0, p_token_input) * v_costo_input + greatest(0, p_token_output) * v_costo_output) / 1000000.0, 4),
    updated_at = now();

  update public.agente_utilizzo_mensile
  set quota_superata = (richieste_count >= v_quota)
  where tenant_id = p_tenant_id and periodo = v_periodo;
end;
$$;

grant execute on function public.pm_agente_quota_richieste(uuid) to authenticated, service_role;
grant execute on function public.pm_agente_quota_superata(uuid) to authenticated, service_role;
grant execute on function public.pm_agente_registra_utilizzo(uuid, integer, integer) to service_role;
