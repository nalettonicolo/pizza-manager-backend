-- Fase 4: fidelity cliente (portale) + coda notifiche nuovo ordine web.

CREATE OR REPLACE FUNCTION public.cliente_get_fidelity_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente public.clienti%ROWTYPE;
  v_anagrafica_id uuid;
  v_saldo public.fidelity_saldi%ROWTYPE;
  v_movimenti jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cliente FROM public.clienti WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('attivo', false, 'motivo', 'profilo_cliente_assente');
  END IF;

  SELECT ac.id INTO v_anagrafica_id
  FROM public.anagrafica_clienti ac
  WHERE ac.tenant_id = v_cliente.tenant_id
    AND trim(lower(ac.nome)) = trim(lower(COALESCE(v_cliente.nome, '')))
    AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(COALESCE(v_cliente.indirizzo, '')))
    AND trim(COALESCE(ac.telefono, '')) = trim(COALESCE(v_cliente.telefono, ''))
  ORDER BY ac.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_anagrafica_id IS NULL THEN
    RETURN jsonb_build_object('attivo', false, 'motivo', 'anagrafica_non_collegata');
  END IF;

  SELECT * INTO v_saldo
  FROM public.fidelity_saldi fs
  WHERE fs.tenant_id = v_cliente.tenant_id
    AND fs.anagrafica_cliente_id = v_anagrafica_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'punti', fm.punti,
        'tipo', fm.tipo,
        'note', fm.note,
        'created_at', fm.created_at
      )
      ORDER BY fm.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_movimenti
  FROM (
    SELECT fm.punti, fm.tipo, fm.note, fm.created_at
    FROM public.fidelity_movimenti fm
    WHERE fm.tenant_id = v_cliente.tenant_id
      AND fm.anagrafica_cliente_id = v_anagrafica_id
    ORDER BY fm.created_at DESC
    LIMIT 20
  ) fm;

  RETURN jsonb_build_object(
    'attivo', true,
    'punti', COALESCE(v_saldo.punti, 0),
    'codice_carta', v_saldo.codice_carta,
    'nome_negozio', v_saldo.nome_negozio,
    'movimenti', v_movimenti
  );
END;
$$;

COMMENT ON FUNCTION public.cliente_get_fidelity_profile() IS
  'Saldo fidelity e ultimi movimenti per cliente autenticato (match anagrafica_clienti).';

REVOKE ALL ON FUNCTION public.cliente_get_fidelity_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_get_fidelity_profile() TO authenticated;

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

  SELECT COALESCE(
    NULLIF(trim(t.email_fatturazione), ''),
    NULLIF(trim(t.pec), ''),
    'staff@tenant'
  )
  INTO v_dest
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  INSERT INTO public.notifiche_outbox (tenant_id, tipo, destinatario, payload)
  VALUES (
    p_tenant_id,
    'nuovo_ordine_web',
    COALESCE(v_dest, 'staff@tenant'),
    jsonb_build_object('ordine_id', p_ordine_id, 'source', 'web_checkout')
  );
END;
$$;

COMMENT ON FUNCTION public.enqueue_nuovo_ordine_web_notifica(UUID, UUID) IS
  'Accoda notifica staff su nuovo ordine web (notifiche_outbox).';

REVOKE ALL ON FUNCTION public.enqueue_nuovo_ordine_web_notifica(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_nuovo_ordine_web_notifica(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_nuovo_ordine_web_notifica(UUID, UUID) TO anon;
