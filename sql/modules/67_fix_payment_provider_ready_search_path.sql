-- Modulo 67 — search_path esplicito su public._payment_provider_ready
--
-- Trovato durante uno stress test generale (advisor di sicurezza Supabase, "Function Search Path
-- Mutable"): era l'unica funzione nel database senza SET search_path esplicito. Funzione pura
-- (nessun accesso a tabelle, solo manipolazione dei parametri jsonb ricevuti), quindi il fix è a
-- rischio nullo: nessuna logica cambiata, solo SET search_path TO 'public' aggiunto.

CREATE OR REPLACE FUNCTION public._payment_provider_ready(p_provider_key text, p_public jsonb, p_stripe_secret boolean, p_sumup_secret boolean, p_provider_secrets jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pub JSONB := COALESCE(p_public, '{}'::jsonb);
  v_sec JSONB := COALESCE(p_provider_secrets, '{}'::jsonb);
BEGIN
  CASE lower(trim(COALESCE(p_provider_key, '')))
    WHEN 'stripe' THEN
      RETURN COALESCE(v_pub->>'stripe_publishable_key', '') LIKE 'pk_%'
        AND COALESCE(p_stripe_secret, false);
    WHEN 'sumup' THEN
      RETURN length(COALESCE(v_pub->>'sumup_merchant_public_id', '')) >= 4
        AND COALESCE(p_sumup_secret, false);
    WHEN 'satispay' THEN
      RETURN length(COALESCE(v_pub->>'satispay_key_id', '')) >= 3
        AND btrim(COALESCE(v_sec->'satispay'->>'token', '')) <> '';
    WHEN 'nexi' THEN
      RETURN length(COALESCE(v_pub->>'nexi_alias', '')) >= 3
        AND btrim(COALESCE(v_sec->'nexi'->>'api_key', '')) <> '';
    WHEN 'paypal' THEN
      RETURN length(COALESCE(v_pub->>'paypal_client_id', '')) >= 8
        AND btrim(COALESCE(v_sec->'paypal'->>'secret', '')) <> '';
    ELSE
      RETURN false;
  END CASE;
END;
$function$;
