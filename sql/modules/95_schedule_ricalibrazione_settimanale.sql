-- Modulo 95 — Schedulazione pg_cron per la ricalibrazione settimanale (Piano B)
--
-- Ogni lunedì alle 03:00 UTC (notte, fuori dagli orari di servizio) il job di ricalibrazione
-- analizza la settimana appena chiusa e propone eventuali cambiamenti a pizze_ogni_15_min — mai
-- applicati in automatico, vedi sql/modules/94_calibrazione_tempi_ai_settimanale.sql e
-- supabase/functions/ricalibra-tempi-attesa/index.ts.
--
-- L'header Authorization usa la anon key (pubblica per natura, già nel bundle frontend — non è
-- un segreto da proteggere come la service_role key, che l'Edge Function legge da sé via
-- Deno.env e non deve mai comparire in una migration): sufficiente a superare la verifica JWT di
-- default delle Edge Function Supabase, i privilegi elevati restano tutti lato server.
--
-- Approfitta dell'occasione per schedulare anche il worker notifiche_outbox (email di questa
-- ricalibrazione comprese), che esisteva già nel repo ma non risultava ancora collegato a nessun
-- trigger periodico.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nome migrazione: schedule_ricalibrazione_settimanale).
-- Verificato con `select jobid, jobname, schedule, active from cron.job` dopo l'applicazione.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ricalibra-tempi-attesa-settimanale',
  '0 3 * * 1',
  $$
  select net.http_post(
    url := 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/ricalibra-tempi-attesa',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZmhyd3pscmZ0dWhrcmZ3enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzY0MjEsImV4cCI6MjA3NDU1MjQyMX0.5JRY5xAGbr8ZSbwB6-aFZ45hVP-nxG7G265Nt5LZIiY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'notifiche-outbox-processor-periodico',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/notifiche-outbox-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZmhyd3pscmZ0dWhrcmZ3enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzY0MjEsImV4cCI6MjA3NDU1MjQyMX0.5JRY5xAGbr8ZSbwB6-aFZ45hVP-nxG7G265Nt5LZIiY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
