-- Modulo 104 — Riconciliazione pagamenti SumUp abbandonati
--
-- Bug trovato in audit: a differenza di Stripe (che ha un webhook come fonte di verità
-- asincrona), SumUp qui dipende SOLO dal client che richiama payment-sumup-confirm dopo il
-- redirect. Se il cliente chiude il browser, perde la connessione o l'app si sospende subito dopo
-- aver pagato (molto comune su mobile durante il redirect di ritorno), SumUp ha incassato ma
-- l'ordine resta 'IN_ATTESA' per sempre: nessuna riconciliazione lato server esisteva.
--
-- Fix: RPC che elenca gli ordini SumUp "in sospeso da un po'" (checkout attaccato, non ancora
-- succeeded, aggiornato tra 2 minuti fa — per non correre contro il polling del client — e 48 ore
-- fa, oltre le quali si considera abbandonato e non si ricontrolla più). L'edge function
-- sumup-reconcile-pending (schedulata ogni 5 minuti) li ricontrolla uno a uno contro l'API SumUp
-- con la chiave del tenant e marca pagati quelli risultati completati.

CREATE OR REPLACE FUNCTION public.edge_sumup_pending_reconciliation(p_max_age_hours INTEGER DEFAULT 48)
RETURNS TABLE (ordine_id UUID, tenant_id UUID, checkout_id TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pg_temp
AS $$
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT o.id, o.tenant_id, (o.online_payment->>'sumup_checkout_id')::text, o.updated_at
  FROM core.ordini o
  WHERE o.stato::text = 'IN_ATTESA'
    AND lower(trim(COALESCE(o.online_payment->>'provider', ''))) = 'sumup'
    AND o.online_payment->>'sumup_checkout_id' IS NOT NULL
    AND COALESCE(o.online_payment->>'status', '') IS DISTINCT FROM 'succeeded'
    AND o.updated_at < now() - interval '2 minutes'
    AND o.updated_at > now() - make_interval(hours => GREATEST(1, p_max_age_hours))
    AND o.deleted_at IS NULL
  ORDER BY o.updated_at ASC
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edge_sumup_pending_reconciliation(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edge_sumup_pending_reconciliation(INTEGER) TO service_role;

COMMENT ON FUNCTION public.edge_sumup_pending_reconciliation(INTEGER) IS
  'Ordini SumUp con checkout attaccato ma mai confermato (client non ha richiamato payment-sumup-confirm dopo il redirect). Usata da sumup-reconcile-pending via cron ogni 5 minuti.';

SELECT cron.schedule(
  'sumup-reconcile-pending-periodico',
  '* * * * *', -- ogni 60 secondi: richiesta esplicita dell'utente (pg_cron non supporta granularità sub-minuto)
  $$
  SELECT net.http_post(
    url := 'https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/sumup-reconcile-pending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZmhyd3pscmZ0dWhrcmZ3enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzY0MjEsImV4cCI6MjA3NDU1MjQyMX0.5JRY5xAGbr8ZSbwB6-aFZ45hVP-nxG7G265Nt5LZIiY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $$
);
