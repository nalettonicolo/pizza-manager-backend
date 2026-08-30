-- Modulo 117 — Autenticazione dei cron verso le Edge Function (x-cron-secret)
--
-- Audit sicurezza: i cron pg_cron invocavano le Edge Function con la sola anon key (pubblica),
-- quindi chiunque conoscesse l'URL poteva invocarle (OWASP A01/A05). Le Edge Function ora
-- verificano l'header `x-cron-secret` (guardia "enforce-if-configured" in
-- supabase/functions/_shared/cronAuth.ts): se il secret e configurato, le chiamate senza header
-- corretto ricevono 401.
--
-- Il valore del secret NON e in questo file: vive solo nel Vault Supabase (name='cron_secret')
-- e nei secret delle Edge Function (CRON_SECRET). Qui i cron lo leggono a runtime dal Vault.
--
-- cron.schedule con lo stesso jobname aggiorna il job esistente (pg_cron >= 1.4).
-- I job aggiornati: notifiche-outbox-processor-periodico, ricalibra-tempi-attesa-settimanale,
-- sumup-reconcile-pending-periodico. fiscal-outbox-processor non ha cron attivo (dormiente): la
-- guardia lato Edge lo protegge comunque.

DO $$
DECLARE
  v_anon text := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZmhyd3pscmZ0dWhrcmZ3enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzY0MjEsImV4cCI6MjA3NDU1MjQyMX0.5JRY5xAGbr8ZSbwB6-aFZ45hVP-nxG7G265Nt5LZIiY';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    RAISE EXCEPTION 'Vault: secret cron_secret mancante. Eseguire prima scripts/_setup-cron-secret.mjs';
  END IF;

  PERFORM cron.schedule(
    'notifiche-outbox-processor-periodico',
    '*/10 * * * *',
    format($job$
      select net.http_post(
        url := 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/notifiche-outbox-processor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L,
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$, v_anon)
  );

  PERFORM cron.schedule(
    'ricalibra-tempi-attesa-settimanale',
    '0 3 * * 1',
    format($job$
      select net.http_post(
        url := 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/ricalibra-tempi-attesa',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L,
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$, v_anon)
  );

  PERFORM cron.schedule(
    'sumup-reconcile-pending-periodico',
    '* * * * *',
    format($job$
      SELECT net.http_post(
        url := 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/sumup-reconcile-pending',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L,
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 45000
      );
    $job$, v_anon)
  );
END $$;
