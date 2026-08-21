-- Cliente autenticato: iscrizione self-service al programma fidelity del proprio tenant.
-- Crea/allinea anagrafica_clienti e fidelity_saldi (saldo 0 + codice carta).

CREATE OR REPLACE FUNCTION public.cliente_iscriviti_fidelity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente public.clienti%ROWTYPE;
  v_po jsonb;
  v_attivo boolean;
  v_anagrafica_id uuid;
  v_saldo public.fidelity_saldi%ROWTYPE;
  v_codice text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
  v_attempt int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cliente FROM public.clienti WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profilo cliente non trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT t.parametri_operativi INTO v_po
  FROM public.tenants t
  WHERE t.id = v_cliente.tenant_id;

  v_po := COALESCE(v_po, '{}'::jsonb);
  -- Default attivo se chiave assente (allineato a UI cassa / area cliente).
  IF v_po ? 'fidelity_attivo' THEN
    v_attivo := NOT (
      (v_po->>'fidelity_attivo') IN ('false', '0')
      OR (jsonb_typeof(v_po->'fidelity_attivo') = 'boolean' AND (v_po->>'fidelity_attivo')::boolean IS FALSE)
    );
  ELSE
    v_attivo := true;
  END IF;

  IF NOT v_attivo THEN
    RAISE EXCEPTION 'Il programma fidelity non è attivo per questo locale' USING ERRCODE = 'P0001';
  END IF;

  -- Match anagrafica: email, oppure nome+indirizzo+telefono (come cliente_get_fidelity_profile).
  SELECT ac.id INTO v_anagrafica_id
  FROM public.anagrafica_clienti ac
  WHERE ac.tenant_id = v_cliente.tenant_id
    AND (
      (
        NULLIF(trim(lower(COALESCE(v_cliente.email, ''))), '') IS NOT NULL
        AND trim(lower(COALESCE(ac.email, ''))) = trim(lower(v_cliente.email))
      )
      OR (
        NULLIF(trim(COALESCE(v_cliente.nome, '')), '') IS NOT NULL
        AND trim(lower(ac.nome)) = trim(lower(v_cliente.nome))
        AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(COALESCE(v_cliente.indirizzo, '')))
        AND trim(COALESCE(ac.telefono, '')) = trim(COALESCE(v_cliente.telefono, ''))
      )
    )
  ORDER BY
    CASE
      WHEN NULLIF(trim(lower(COALESCE(v_cliente.email, ''))), '') IS NOT NULL
        AND trim(lower(COALESCE(ac.email, ''))) = trim(lower(v_cliente.email))
      THEN 0 ELSE 1
    END,
    ac.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_anagrafica_id IS NULL THEN
    INSERT INTO public.anagrafica_clienti (tenant_id, nome, indirizzo, telefono, email)
    VALUES (
      v_cliente.tenant_id,
      COALESCE(NULLIF(trim(v_cliente.nome), ''), 'Cliente'),
      NULLIF(trim(COALESCE(v_cliente.indirizzo, '')), ''),
      NULLIF(trim(COALESCE(v_cliente.telefono, '')), ''),
      NULLIF(trim(COALESCE(v_cliente.email, '')), '')
    )
    RETURNING id INTO v_anagrafica_id;
  ELSE
    UPDATE public.anagrafica_clienti ac
    SET
      nome = COALESCE(NULLIF(trim(v_cliente.nome), ''), ac.nome),
      indirizzo = COALESCE(NULLIF(trim(COALESCE(v_cliente.indirizzo, '')), ''), ac.indirizzo),
      telefono = COALESCE(NULLIF(trim(COALESCE(v_cliente.telefono, '')), ''), ac.telefono),
      email = COALESCE(NULLIF(trim(COALESCE(v_cliente.email, '')), ''), ac.email)
    WHERE ac.id = v_anagrafica_id;
  END IF;

  SELECT * INTO v_saldo
  FROM public.fidelity_saldi fs
  WHERE fs.tenant_id = v_cliente.tenant_id
    AND fs.anagrafica_cliente_id = v_anagrafica_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'già_iscritto', true,
      'codice_carta', v_saldo.codice_carta,
      'punti', COALESCE(v_saldo.punti, 0),
      'anagrafica_cliente_id', v_anagrafica_id
    );
  END IF;

  v_codice := NULL;
  FOR v_attempt IN 1..12 LOOP
    v_codice := '';
    FOR v_i IN 1..8 LOOP
      v_codice := v_codice || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.fidelity_saldi (
        tenant_id, anagrafica_cliente_id, punti, codice_carta
      ) VALUES (
        v_cliente.tenant_id, v_anagrafica_id, 0, v_codice
      )
      RETURNING * INTO v_saldo;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_codice := NULL;
    END;
  END LOOP;

  IF v_codice IS NULL OR v_saldo.id IS NULL THEN
    RAISE EXCEPTION 'Impossibile generare un codice carta univoco' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'già_iscritto', false,
    'codice_carta', v_saldo.codice_carta,
    'punti', 0,
    'anagrafica_cliente_id', v_anagrafica_id
  );
END;
$$;

COMMENT ON FUNCTION public.cliente_iscriviti_fidelity() IS
  'Iscrizione self-service fidelity: anagrafica + fidelity_saldi per auth.uid() se fidelity_attivo sul tenant.';

REVOKE ALL ON FUNCTION public.cliente_iscriviti_fidelity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_iscriviti_fidelity() TO authenticated;
