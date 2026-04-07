-- Turni cassa: RPC SECURITY DEFINER (staff tenant) + colonne riconciliazione chiusura.
-- Richiede public.turni_operatori, public.utenti_ruoli, public.punti_vendita.

ALTER TABLE public.turni_operatori
  ADD COLUMN IF NOT EXISTS fondo_contato_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS incasso_atteso_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS delta_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS note_chiusura text;

COMMENT ON COLUMN public.turni_operatori.fondo_contato_euro IS 'Conteggio cassa alla chiusura (riconciliazione).';
COMMENT ON COLUMN public.turni_operatori.incasso_atteso_euro IS 'Incasso atteso (es. da sistema) al momento della chiusura.';
COMMENT ON COLUMN public.turni_operatori.delta_euro IS 'fondo_contato - incasso_atteso (se entrambi valorizzati).';
COMMENT ON COLUMN public.turni_operatori.note_chiusura IS 'Note operatore in chiusura turno.';

CREATE OR REPLACE FUNCTION public._turni_cassa_assert_staff(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND (ur.attivo IS DISTINCT FROM false)
  ) THEN
    RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_aperto(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  SELECT jsonb_build_object(
    'id', t.id,
    'punto_vendita_id', t.punto_vendita_id,
    'stato', t.stato,
    'aperto_il', t.aperto_il,
    'chiuso_il', t.chiuso_il,
    'fondo_contato_euro', t.fondo_contato_euro,
    'incasso_atteso_euro', t.incasso_atteso_euro,
    'delta_euro', t.delta_euro,
    'note_chiusura', t.note_chiusura
  )
  INTO r
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT 1;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_apri(p_tenant_id uuid, p_punto_vendita_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  existing_pv uuid;
  v_new_id integer;
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  IF p_punto_vendita_id IS NULL THEN
    RAISE EXCEPTION 'punto_vendita_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.punti_vendita pv
    WHERE pv.id = p_punto_vendita_id
      AND pv.tenant_id = p_tenant_id
      AND pv.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'punto_vendita_non_valido' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.punto_vendita_id
  INTO existing_pv
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  LIMIT 1;

  IF FOUND THEN
    IF existing_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_aperto_altro_pv' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
      'id', t.id,
      'punto_vendita_id', t.punto_vendita_id,
      'stato', t.stato,
      'aperto_il', t.aperto_il,
      'chiuso_il', t.chiuso_il,
      'gia_aperto', true
    )
    INTO r
    FROM public.turni_operatori t
    WHERE t.user_id = auth.uid()
      AND t.tenant_id = p_tenant_id
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL
    LIMIT 1;

    RETURN r;
  END IF;

  INSERT INTO public.turni_operatori (user_id, tenant_id, punto_vendita_id, stato, aperto_il)
  VALUES (auth.uid(), p_tenant_id, p_punto_vendita_id, 'aperto', now())
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'id', t.id,
    'punto_vendita_id', t.punto_vendita_id,
    'stato', t.stato,
    'aperto_il', t.aperto_il,
    'chiuso_il', t.chiuso_il,
    'gia_aperto', false
  )
  INTO r
  FROM public.turni_operatori t
  WHERE t.id = v_new_id;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_chiudi(
  p_tenant_id uuid,
  p_fondo_contato_euro numeric,
  p_incasso_atteso_euro numeric DEFAULT NULL,
  p_note_chiusura text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_delta numeric(12, 2);
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  IF p_fondo_contato_euro IS NULL THEN
    RAISE EXCEPTION 'fondo_contato_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id
  INTO v_id
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'nessun_turno_aperto' USING ERRCODE = 'P0001';
  END IF;

  v_delta := CASE
    WHEN p_incasso_atteso_euro IS NULL THEN NULL
    ELSE round(p_fondo_contato_euro - p_incasso_atteso_euro, 2)
  END;

  UPDATE public.turni_operatori t
  SET
    stato = 'chiuso',
    chiuso_il = now(),
    fondo_contato_euro = p_fondo_contato_euro,
    incasso_atteso_euro = p_incasso_atteso_euro,
    delta_euro = v_delta,
    note_chiusura = NULLIF(trim(p_note_chiusura), '')
  WHERE t.id = v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'chiuso', true,
    'fondo_contato_euro', p_fondo_contato_euro,
    'incasso_atteso_euro', p_incasso_atteso_euro,
    'delta_euro', v_delta
  );
END;
$$;

ALTER FUNCTION public._turni_cassa_assert_staff(uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_aperto(uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_apri(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public._turni_cassa_assert_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_aperto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_apri(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.turni_cassa_aperto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turni_cassa_apri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) TO authenticated;
