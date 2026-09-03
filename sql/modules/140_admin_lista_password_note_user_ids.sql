-- Modulo 140 — RPC di supporto per l'archivio password (dopo il modulo 139)
--
-- Il modulo 139 ha tolto ai tenant_admin la SELECT diretta su staff_password_note (ora solo
-- superadmin, o via la RPC admin_richiedi_password_nota con verifica password + audit).
-- Serve però un modo, per la UI Admin -> Ruoli -> Archivio password, di sapere QUALI utenti
-- hanno una nota registrata (per poi chiedere il contenuto uno a uno via
-- admin_richiedi_password_nota) — questo elenco di ID non è di per sé un segreto (dice solo "per
-- questo dipendente esiste una nota", non il contenuto), quindi non richiede la ri-conferma
-- password: la richiede solo la lettura del contenuto, come già per il singolo dipendente.

CREATE OR REPLACE FUNCTION public.admin_lista_password_note_user_ids(p_tenant_id uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_admins ta
    WHERE ta.user_id = auth.uid() AND ta.tenant_id = p_tenant_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT spn.user_id
  FROM public.staff_password_note spn
  WHERE spn.tenant_id = p_tenant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_lista_password_note_user_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_lista_password_note_user_ids(uuid) TO authenticated;
