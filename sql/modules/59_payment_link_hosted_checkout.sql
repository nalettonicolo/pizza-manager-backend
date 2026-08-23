-- =============================================================================
-- Modulo 59 — Pagina di pagamento ospitata per il pay-by-link (backlog WhatsApp)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 via MCP apply_migration.
-- =============================================================================
--
-- Prima di questo modulo, runUnifiedPayByLinkSetup() creava un payment_link_intents e, per
-- Stripe, un PaymentIntent — ma senza nessuna pagina cliente a cui puntare, il "link" non
-- esisteva davvero (client_secret usato solo dal checkout in-pagina della vetrina). Queste RPC
-- sono lette/scritte SOLO dalla nuova Edge Function `payment-link-checkout` (service_role,
-- nessun accesso anonimo diretto alle tabelle) — la pagina pubblica /paga/:intentId non legge
-- mai payment_link_intents direttamente.

CREATE OR REPLACE FUNCTION public.edge_payment_link_intent_get(p_intent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin, pg_temp
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'id', pli.id,
    'tenantId', pli.tenant_id,
    'tenantNome', t.nome,
    'logoUrl', t.logo_url,
    'stripePublishableKey', t.stripe_publishable_key,
    'ordineId', pli.ordine_id,
    'numero', o.numero,
    'importoCent', pli.importo_cent,
    'valuta', pli.valuta,
    'status', pli.status,
    'providerKey', pli.provider_key,
    'providerIntentId', pli.provider_intent_id
  ) INTO v_row
  FROM public.payment_link_intents pli
  LEFT JOIN admin.tenants t ON t.id = pli.tenant_id
  LEFT JOIN core.ordini o ON o.id = pli.ordine_id
  WHERE pli.id = p_intent_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.edge_payment_link_intent_get(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edge_payment_link_intent_get(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_payment_link_attach_stripe_intent(
  p_intent_id uuid,
  p_provider_intent_id text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pg_temp
AS $$
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.payment_link_intents
  SET
    provider_intent_id = p_provider_intent_id,
    status = COALESCE(NULLIF(trim(p_status), ''), status),
    updated_at = now()
  WHERE id = p_intent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.edge_payment_link_attach_stripe_intent(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edge_payment_link_attach_stripe_intent(uuid, text, text) TO service_role;

-- Riflette l'esito del pagamento anche su payment_link_intents (non solo su core.ordini):
-- la pagina di pagamento ospitata e il pannello "Paga online" in Cassa leggono da qui.
CREATE OR REPLACE FUNCTION public.edge_stripe_mark_payment_succeeded(p_payment_intent_id TEXT, p_charge_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $ok$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    stato = CASE
      WHEN COALESCE(o.richiede_accettazione_cassa, false) THEN o.stato
      ELSE 'IN_PREPARAZIONE'::core.stato_ordine
    END,
    tipo_pagamento = 'Carta (Stripe — pagato)',
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', 'succeeded',
      'charge_id', p_charge_id,
      'paid_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    updated_at = now()
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  RETURNING o.id INTO v_id;

  UPDATE public.payment_link_intents
  SET status = 'paid', paid_at = now(), updated_at = now()
  WHERE provider_intent_id = p_payment_intent_id;

  RETURN v_id;
END;
$ok$;

CREATE OR REPLACE FUNCTION public.edge_stripe_mark_payment_failed(p_payment_intent_id TEXT, p_message TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', 'payment_failed',
      'failure_message', LEFT(COALESCE(p_message, ''), 2000)
    ),
    updated_at = now()
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  RETURNING o.id INTO v_id;

  UPDATE public.payment_link_intents
  SET status = 'failed', last_error = LEFT(COALESCE(p_message, ''), 2000), updated_at = now()
  WHERE provider_intent_id = p_payment_intent_id;

  RETURN v_id;
END;
$$;
