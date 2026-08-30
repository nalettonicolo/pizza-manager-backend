-- Modulo 123 — Il pony imposta il proprio nome al login (visibile su mappa live cassa)
--
-- Flusso: ogni pony accede con la propria mail; a ogni login gli chiediamo il nome, che aggiorna
-- core.rider.nome_display del SUO record (auth_user_id = auth.uid()). Così sulla mappa live la
-- cassa vede il motorino con il nome giusto. SECURITY DEFINER ma agisce solo sul record del
-- chiamante: nessun accesso ad altri rider/tenant.

CREATE OR REPLACE FUNCTION public.rider_set_nome_display(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text := btrim(COALESCE(p_nome, ''));
  v_out text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF length(v_nome) < 1 THEN
    RAISE EXCEPTION 'nome_obbligatorio';
  END IF;
  IF length(v_nome) > 60 THEN
    v_nome := left(v_nome, 60);
  END IF;

  UPDATE core.rider
  SET nome_display = v_nome
  WHERE auth_user_id = v_uid
    AND deleted_at IS NULL
  RETURNING nome_display INTO v_out;

  RETURN v_out; -- NULL se l'utente non è un rider mappato: il client lo gestisce senza errore
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_set_nome_display(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_set_nome_display(text) TO authenticated;

COMMENT ON FUNCTION public.rider_set_nome_display(text) IS
  'Il rider aggiorna il proprio nome visualizzato (core.rider.nome_display del record col proprio auth_user_id). Usato al login della PWA pony.';
