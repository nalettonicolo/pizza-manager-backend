-- Cliente autenticato: aggiorna il proprio profilo (vetrina) senza accesso staff.

CREATE OR REPLACE FUNCTION public.cliente_aggiorna_proprio_profilo(
  p_nome text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_indirizzo text DEFAULT NULL,
  p_note_consegna text DEFAULT NULL,
  p_latitudine double precision DEFAULT NULL,
  p_longitudine double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;

  UPDATE public.clienti
  SET
    nome = COALESCE(NULLIF(trim(COALESCE(p_nome, '')), ''), nome),
    telefono = COALESCE(NULLIF(trim(COALESCE(p_telefono, '')), ''), telefono),
    indirizzo = COALESCE(NULLIF(trim(COALESCE(p_indirizzo, '')), ''), indirizzo),
    note_consegna = COALESCE(p_note_consegna, note_consegna, ''),
    latitudine = COALESCE(p_latitudine, latitudine),
    longitudine = COALESCE(p_longitudine, longitudine)
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profilo cliente non trovato' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.cliente_aggiorna_proprio_profilo IS
  'Aggiorna public.clienti per auth.uid(); campi anagrafici e note consegna (vetrina).';

REVOKE ALL ON FUNCTION public.cliente_aggiorna_proprio_profilo FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_aggiorna_proprio_profilo TO authenticated;
