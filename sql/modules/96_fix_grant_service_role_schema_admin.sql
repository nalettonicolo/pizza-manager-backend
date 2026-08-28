-- Modulo 96 — Fix: service_role senza grant sullo schema admin
--
-- Scoperto testando supabase/functions/ricalibra-tempi-attesa/index.ts: "permission denied for
-- table tenants". service_role (il ruolo con cui girano TUTTE le Edge Function) non aveva NESSUN
-- grant su admin.tenants — solo postgres/authenticated/anon ce l'avevano. Verificato che lo stesso
-- mancava su altre 6 tabelle dello schema admin: audit_global, licenze, licenze_pagamenti,
-- piani_config, sa_catalog_snapshot, tenant_online_payment_providers (solo tenant_payment_secrets
-- e — dopo il primo fix di questa sessione — tenants ce l'avevano già).
--
-- Mai emerso prima perché nessuna Edge Function che tocca questo schema via PostgREST era mai
-- stata invocata con successo end-to-end (l'agente AI, che tocca admin.tenants nello stesso modo,
-- non era mai stato attivato in produzione).
--
-- service_role bypassa comunque RLS per design (è il ruolo con privilegi di sistema delle Edge
-- Function): questi GRANT allineano i permessi di base a quello che il ruolo dovrebbe già poter
-- fare, non aprono nulla che non fosse già nelle sue intenzioni d'uso.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nomi migrazione: grant_service_role_admin_tenants,
-- grant_service_role_admin_schema_completo).
grant select, insert, update, delete on admin.tenants to service_role;
grant select, insert, update, delete on admin.audit_global to service_role;
grant select, insert, update, delete on admin.licenze to service_role;
grant select, insert, update, delete on admin.licenze_pagamenti to service_role;
grant select, insert, update, delete on admin.piani_config to service_role;
grant select, insert, update, delete on admin.sa_catalog_snapshot to service_role;
grant select, insert, update, delete on admin.tenant_online_payment_providers to service_role;

-- Qualunque futura tabella nello schema admin erediti già il grant corretto per service_role
-- senza doverlo ricordare ogni volta.
alter default privileges in schema admin grant select, insert, update, delete on tables to service_role;
