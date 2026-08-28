-- Modulo 99 — Fix sistematico: pattern "schema admin/core non esposto via PostgREST"
--
-- Continuando l'analisi dopo i due bug già corretti in sessione (agente-chat, ricalibra-tempi-
-- attesa), ho cercato in tutto il progetto lo stesso pattern (`supabase.schema("admin")` lato
-- client/edge function) per trovare altri punti mai stati testati con successo end-to-end.
--
-- Trovati e corretti:
-- 1. src/features/admin/services/tenantDocumentiService.js — getTenantDatiFiscali() usava
--    .schema("admin").from("tenants") SENZA alcun fallback (a differenza di
--    superadminService.js, che gestisce già questo caso da tempo con isSchemaNotExposedError).
--    La pagina Documenti (contratti/firma tenant) probabilmente falliva sempre nel caricare i
--    dati fiscali. Corretto usando la vista public.tenants, stesso pattern già in uso altrove.
-- 2. src/features/superadmin/catalog/catalogRemoteSync.js — il sync del catalogo servizi/piani
--    Super Admin tra browser diversi usava .schema("admin").from("sa_catalog_snapshot") e
--    falliva sempre (silenziosamente, solo console.warn). Non esiste una vista public
--    equivalente per questa tabella (RLS "solo superadmin" su tutte le operazioni, quindi non
--    andrebbe esposta come vista semplice al pubblico): creata una coppia di RPC dedicate
--    (pm_get_catalog_snapshot / pm_set_catalog_snapshot, sotto) che vivono in schema public e
--    verificano il ruolo superadmin internamente.
--
-- Inoltre, grant preventivo su schema core (stesso bug di grant mancante per service_role già
-- corretto oggi su schema admin, esteso qui a tutte le tabelle operative: ordini, prodotti,
-- ingredienti, categorie, ecc.) — nessuna Edge Function lo usa direttamente oggi (passano tutte
-- da viste public o RPC SECURITY DEFINER, che bypassano comunque RLS/grant del chiamante), ma è
-- un fix a basso rischio per evitare lo stesso problema in futuro.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nomi migrazione: fix_catalog_snapshot_rpc,
-- grant_service_role_schema_core).

create or replace function public.pm_get_catalog_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, admin
as $$
declare
  v_row admin.sa_catalog_snapshot%rowtype;
begin
  if not exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = auth.uid() and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ) then
    raise exception 'non_autorizzato';
  end if;

  select * into v_row from admin.sa_catalog_snapshot where snapshot_key = 'default';
  if not found then
    return null;
  end if;
  return jsonb_build_object('services', v_row.services_json, 'plans', v_row.plans_json, 'updated_at', v_row.updated_at);
end;
$$;

create or replace function public.pm_set_catalog_snapshot(p_services jsonb default null, p_plans jsonb default null)
returns void
language plpgsql
security definer
set search_path = public, admin
as $$
begin
  if not exists (
    select 1 from public.utenti_ruoli ur
    where ur.user_id = auth.uid() and coalesce(ur.attivo, true) = true
      and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')
  ) then
    raise exception 'non_autorizzato';
  end if;

  insert into admin.sa_catalog_snapshot (snapshot_key, services_json, plans_json, updated_at, updated_by)
  values ('default', p_services, p_plans, now(), auth.uid())
  on conflict (snapshot_key) do update set
    services_json = coalesce(p_services, admin.sa_catalog_snapshot.services_json),
    plans_json = coalesce(p_plans, admin.sa_catalog_snapshot.plans_json),
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

grant execute on function public.pm_get_catalog_snapshot() to authenticated;
grant execute on function public.pm_set_catalog_snapshot(jsonb, jsonb) to authenticated;

grant select, insert, update, delete on all tables in schema core to service_role;
alter default privileges in schema core grant select, insert, update, delete on tables to service_role;
