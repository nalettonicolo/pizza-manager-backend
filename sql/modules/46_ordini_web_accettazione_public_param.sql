-- Espone ordini_web_accettazione_mode alla vetrina + guard pagamento su accettazione cassa.

CREATE OR REPLACE FUNCTION public.pm_public_parametri_operativi(p_po JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_src JSONB := COALESCE(p_po, '{}'::JSONB);
  v_out JSONB := '{}'::JSONB;
  v_keys TEXT[] := ARRAY[
    'ordini_online_attivi',
    'menuTheme',
    'promozioni_calendario',
    'consegna_area_poligono',
    'consegna_domicilio_attiva',
    'pizze_ogni_15_min',
    'fidelity_attivo',
    'fidelity_abilita_clienti_domicilio',
    'fidelity_modalita_accredito',
    'fidelity_timbri_per_pizza',
    'fidelity_timbri_scheda_totale',
    'fidelity_premi',
    'fidelity_punti_per_euro',
    'ordini_web_accettazione_mode'
  ];
  k TEXT;
BEGIN
  IF jsonb_typeof(v_src) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::JSONB;
  END IF;
  FOREACH k IN ARRAY v_keys LOOP
    IF v_src ? k THEN
      v_out := v_out || jsonb_build_object(k, v_src -> k);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.pm_public_parametri_operativi(JSONB) IS
  'Sottoinsieme parametri_operativi sicuro per anon/vetrina (mod. 40 + 46).';

CREATE OR REPLACE FUNCTION public.staff_accetta_ordine_web(p_ordine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ord core.ordini%ROWTYPE;
  v_ok boolean;
  v_pay TEXT;
  v_op_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_obbligatorio';
  END IF;

  SELECT * INTO v_ord FROM core.ordini WHERE id = p_ordine_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = v_uid
      AND ur.tenant_id = v_ord.tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) IN ('cassa', 'admin', 'owner', 'superadmin')
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'permesso_negato' USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE(v_ord.richiede_accettazione_cassa, false) THEN
    RETURN jsonb_build_object('ok', true, 'già_accettato', true, 'ordine_id', v_ord.id, 'stato', v_ord.stato);
  END IF;

  v_pay := lower(trim(COALESCE(v_ord.tipo_pagamento, '')));
  v_op_status := lower(trim(COALESCE(v_ord.online_payment->>'status', '')));
  IF v_op_status IS DISTINCT FROM 'succeeded'
     AND (
       v_pay LIKE '%in attesa%'
       OR (v_pay LIKE '%stripe%' AND v_pay NOT LIKE '%pagato%')
       OR (v_pay LIKE '%sumup%' AND v_pay NOT LIKE '%pagato%')
     )
  THEN
    RAISE EXCEPTION 'pagamento_non_completato'
      USING MESSAGE = 'Completa o verifica il pagamento online prima di accettare l''ordine in cucina.';
  END IF;

  UPDATE core.ordini
  SET
    stato = 'IN_PREPARAZIONE'::core.stato_ordine,
    richiede_accettazione_cassa = false,
    note = trim(BOTH ' ·' FROM regexp_replace(
      COALESCE(note, ''),
      '\s*·\s*Ordine web\s*·\s*in attesa accettazione cassa',
      '',
      'i'
    )),
    updated_at = now()
  WHERE id = p_ordine_id;

  RETURN jsonb_build_object('ok', true, 'già_accettato', false, 'ordine_id', p_ordine_id, 'stato', 'IN_PREPARAZIONE');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_accetta_ordine_web(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_accetta_ordine_web(UUID) TO authenticated;
