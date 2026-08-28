-- Modulo 103 — Fix grant EXECUTE su PUBLIC per le RPC del modulo 102
--
-- Postgres concede EXECUTE a PUBLIC per default su ogni nuova funzione: i GRANT espliciti nel
-- modulo 102 (a authenticated/service_role) non bastavano da soli a restringere l'accesso, serviva
-- anche il REVOKE esplicito da PUBLIC. Trovato via get_advisors (security) subito dopo
-- l'applicazione del modulo 102: pm_get_alert_configurazione, pm_set_alert_configurazione e
-- pm_processa_digest_errori_supporto risultavano tutte chiamabili da anon via REST. Il controllo
-- ruolo superadmin interno le proteggeva comunque da abusi concreti (auth.uid() è null per anon,
-- quindi la exists() fallisce e la funzione solleva "Permesso negato"), ma
-- pm_processa_digest_errori_supporto non deve essere invocabile da client affatto: solo da
-- pg_cron/service_role.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via apply_migration
-- (nome migrazione: alert_errori_supporto_fix_grants_public). Verificato con query su
-- information_schema.role_routine_grants dopo l'applicazione: solo authenticated (get/set),
-- service_role (digest), anon+authenticated+service_role (registra_errore_operativo, intenzionale).
--
-- Promemoria per i prossimi moduli SQL di questo progetto: ogni CREATE FUNCTION va sempre
-- accompagnata da un REVOKE EXECUTE ... FROM PUBLIC esplicito prima dei GRANT mirati, altrimenti
-- il grant di default resta silenziosamente in vigore.

revoke execute on function public.pm_get_alert_configurazione() from public;
revoke execute on function public.pm_set_alert_configurazione(text, boolean) from public;
revoke execute on function public.pm_processa_digest_errori_supporto() from public;
revoke execute on function public.pm_registra_errore_operativo(uuid, text, text, text, jsonb) from public;

grant execute on function public.pm_get_alert_configurazione() to authenticated;
grant execute on function public.pm_set_alert_configurazione(text, boolean) to authenticated;
grant execute on function public.pm_processa_digest_errori_supporto() to service_role;
grant execute on function public.pm_registra_errore_operativo(uuid, text, text, text, jsonb) to anon, authenticated, service_role;
