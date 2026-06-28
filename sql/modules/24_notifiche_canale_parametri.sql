-- Accodamento notifiche ordine web: canale e destinatario da parametri_operativi tenant.

CREATE OR REPLACE FUNCTION public.enqueue_nuovo_ordine_web_notifica(
  p_tenant_id UUID,
  p_ordine_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $$
DECLARE
  v_dest TEXT;
  v_canale TEXT;
  v_po JSONB;
  v_tel_sms TEXT;
  v_tel_wa TEXT;
  v_email_override TEXT;
BEGIN
  IF p_tenant_id IS NULL OR p_ordine_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clienti c
      WHERE c.id = auth.uid() AND c.tenant_id = p_tenant_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
        AND COALESCE(ur.attivo, true) = true
    ) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF to_regclass('public.notifiche_outbox') IS NULL THEN
    RETURN;
  END IF;

  SELECT t.parametri_operativi
  INTO v_po
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  v_canale := lower(trim(COALESCE(v_po->>'notifica_ordine_web_canale', 'email')));
  IF v_canale NOT IN ('email', 'sms', 'whatsapp', 'in_app') THEN
    v_canale := 'email';
  END IF;

  v_tel_sms := NULLIF(trim(COALESCE(v_po->>'notifica_ordine_web_telefono_sms', '')), '');
  v_tel_wa := NULLIF(trim(COALESCE(v_po->>'notifica_ordine_web_telefono_whatsapp', '')), '');
  v_email_override := NULLIF(trim(COALESCE(v_po->>'notifica_ordine_web_email', '')), '');

  SELECT COALESCE(
    v_email_override,
    NULLIF(trim(t.email_fatturazione), ''),
    NULLIF(trim(t.pec), ''),
    'staff@tenant'
  )
  INTO v_dest
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  IF v_canale = 'sms' AND v_tel_sms IS NOT NULL THEN
    v_dest := v_tel_sms;
  ELSIF v_canale = 'whatsapp' AND v_tel_wa IS NOT NULL THEN
    v_dest := v_tel_wa;
  ELSIF v_canale = 'in_app' THEN
    v_dest := 'operative_dashboard';
  END IF;

  INSERT INTO public.notifiche_outbox (tenant_id, tipo, destinatario, payload)
  VALUES (
    p_tenant_id,
    'nuovo_ordine_web',
    COALESCE(v_dest, 'staff@tenant'),
    jsonb_build_object(
      'ordine_id', p_ordine_id,
      'source', 'web_checkout',
      'canale', v_canale
    )
  );
END;
$$;

COMMENT ON FUNCTION public.enqueue_nuovo_ordine_web_notifica(UUID, UUID) IS
  'Accoda notifica staff; canale da parametri_operativi.notifica_ordine_web_canale (email|sms|whatsapp|in_app).';
