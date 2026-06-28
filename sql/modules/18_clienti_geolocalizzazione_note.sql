-- Clienti vetrina: coordinate consegna e note (registrazione da user_metadata)

ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS latitudine DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitudine DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS note_consegna TEXT;

COMMENT ON COLUMN public.clienti.latitudine IS 'Latitudine punto consegna (da registrazione / profilo).';
COMMENT ON COLUMN public.clienti.longitudine IS 'Longitudine punto consegna (da registrazione / profilo).';
COMMENT ON COLUMN public.clienti.note_consegna IS 'Note operative consegna (citofono, piano, istruzioni rider).';

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_meta JSONB;
  v_nome TEXT;
  v_indirizzo TEXT;
  v_telefono TEXT;
  v_email TEXT;
  v_note_consegna TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_nome := NULLIF(trim(COALESCE(v_meta->>'nome', v_meta->>'full_name', '')), '');
  v_indirizzo := NULLIF(trim(COALESCE(v_meta->>'indirizzo', '')), '');
  v_telefono := NULLIF(trim(COALESCE(v_meta->>'telefono', v_meta->>'phone', '')), '');
  v_email := NULLIF(trim(COALESCE(NEW.email, '')), '');
  v_note_consegna := NULLIF(trim(COALESCE(v_meta->>'note_consegna', '')), '');

  BEGIN
    v_lat := NULLIF(trim(COALESCE(v_meta->>'latitudine', '')), '')::double precision;
  EXCEPTION WHEN OTHERS THEN
    v_lat := NULL;
  END;
  BEGIN
    v_lng := NULLIF(trim(COALESCE(v_meta->>'longitudine', '')), '')::double precision;
  EXCEPTION WHEN OTHERS THEN
    v_lng := NULL;
  END;

  BEGIN
    v_tenant_id := (v_meta->>'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;

  IF v_tenant_id IS NULL AND to_regclass('public.anagrafica_clienti') IS NOT NULL AND v_nome IS NOT NULL THEN
    SELECT ac.tenant_id INTO v_tenant_id
    FROM public.anagrafica_clienti ac
    WHERE trim(lower(ac.nome)) = trim(lower(v_nome))
      AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(COALESCE(v_indirizzo, '')))
      AND trim(COALESCE(ac.telefono, '')) = trim(COALESCE(v_telefono, ''))
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.clienti (id, tenant_id, nome, indirizzo, telefono, email, latitudine, longitudine, note_consegna)
    VALUES (NEW.id, v_tenant_id, v_nome, v_indirizzo, v_telefono, v_email, v_lat, v_lng, v_note_consegna)
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      nome = COALESCE(EXCLUDED.nome, clienti.nome),
      indirizzo = COALESCE(EXCLUDED.indirizzo, clienti.indirizzo),
      telefono = COALESCE(EXCLUDED.telefono, clienti.telefono),
      email = COALESCE(EXCLUDED.email, clienti.email),
      latitudine = COALESCE(EXCLUDED.latitudine, clienti.latitudine),
      longitudine = COALESCE(EXCLUDED.longitudine, clienti.longitudine),
      note_consegna = COALESCE(EXCLUDED.note_consegna, clienti.note_consegna);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Crea/aggiorna public.clienti da raw_user_meta_data (tenant_id, nome, indirizzo, telefono, latitudine, longitudine, note_consegna).';
