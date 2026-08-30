-- Modulo 125 — RPC scrittura parametri_operativi su admin.tenants
--
-- Bug: Admin/Cassa «Parametri operativi» mostrava «Parametri salvati» anche quando
-- l'UPDATE su public.tenants (vista) non scriveva nessuna riga (RLS / 0 row, nessun
-- errore PostgREST). In più updateTenantSettings poteva scartare parametri_operativi
-- in silenzio sul retry PGRST204 (stesso schema del bug sito_web_cliente, mod. 112).
--
-- Fix: RPC SECURITY DEFINER che aggiorna admin.tenants.parametri_operativi e
-- solleva eccezione se il tenant non esiste o l'utente non è staff/superadmin.

CREATE OR REPLACE FUNCTION public.admin_update_tenant_parametri_operativi(
  p_tenant_id uuid,
  p_parametri jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin, pg_temp
AS $$
DECLARE
  v_ok boolean;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obbligatorio';
  END IF;
  IF p_parametri IS NULL OR jsonb_typeof(p_parametri) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'parametri_operativi non validi';
  END IF;

  SELECT
    public.pm_auth_is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) IS NOT FALSE
    )
  INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE admin.tenants
  SET
    parametri_operativi = p_parametri,
    updated_at = now()
  WHERE id = p_tenant_id
    AND deleted_at IS NULL
  RETURNING parametri_operativi INTO v_out;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant non trovato';
  END IF;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.admin_update_tenant_parametri_operativi(uuid, jsonb) IS
  'Scrive admin.tenants.parametri_operativi. Solo superadmin o staff del tenant. Fallisce se 0 righe.';

REVOKE ALL ON FUNCTION public.admin_update_tenant_parametri_operativi(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_tenant_parametri_operativi(uuid, jsonb) TO authenticated;
