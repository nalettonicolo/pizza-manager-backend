-- ============================================================================
-- 116 — RPC atomica per i movimenti fidelity
-- ----------------------------------------------------------------------------
-- Contesto (audit sicurezza): applyFidelityMovimento nel frontend fa un
-- read-modify-write client sul saldo (SELECT punti -> +delta -> UPDATE), non
-- atomico e non validato lato server. OWASP A04 (Insecure Design): due tab o due
-- richieste concorrenti possono perdere/duplicare movimenti (race), e il delta
-- non è vincolato ad alcuna regola.
--
-- Fix: RPC SECURITY DEFINER che
--   1) autorizza il chiamante come staff del tenant (o superadmin);
--   2) blocca la riga saldo con FOR UPDATE (niente race);
--   3) impedisce saldo negativo;
--   4) registra saldo e movimento nella stessa transazione.
--
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT espliciti.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fidelity_applica_movimento(
  p_tenant_id uuid,
  p_anagrafica_cliente_id uuid,
  p_punti_delta integer,
  p_tipo text DEFAULT 'manuale',
  p_note text DEFAULT NULL,
  p_ordine_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_saldo integer;
  v_nuovo integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL OR p_anagrafica_cliente_id IS NULL THEN
    RAISE EXCEPTION 'dati_mancanti';
  END IF;
  IF COALESCE(p_punti_delta, 0) = 0 THEN
    RAISE EXCEPTION 'delta_nullo';
  END IF;

  -- Autorizzazione: staff del tenant (qualsiasi ruolo attivo) o superadmin.
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) IS NOT FALSE
  ) AND NOT public.pm_auth_is_superadmin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lock della riga saldo: serializza i movimenti concorrenti sullo stesso cliente.
  SELECT punti INTO v_saldo
  FROM public.fidelity_saldi
  WHERE tenant_id = p_tenant_id
    AND anagrafica_cliente_id = p_anagrafica_cliente_id
  FOR UPDATE;

  IF v_saldo IS NULL THEN
    RAISE EXCEPTION 'cliente_non_iscritto';
  END IF;

  v_nuovo := v_saldo + p_punti_delta;
  IF v_nuovo < 0 THEN
    RAISE EXCEPTION 'saldo_insufficiente';
  END IF;

  UPDATE public.fidelity_saldi
  SET punti = v_nuovo, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND anagrafica_cliente_id = p_anagrafica_cliente_id;

  INSERT INTO public.fidelity_movimenti
    (tenant_id, anagrafica_cliente_id, punti, tipo, ordine_id, note)
  VALUES
    (p_tenant_id, p_anagrafica_cliente_id, p_punti_delta,
     COALESCE(NULLIF(trim(p_tipo), ''), 'manuale'), p_ordine_id, NULLIF(trim(p_note), ''));

  RETURN v_nuovo;
END;
$$;

COMMENT ON FUNCTION public.fidelity_applica_movimento(uuid, uuid, integer, text, text, uuid) IS
  'Applica atomicamente un movimento punti fidelity (lock saldo, no saldo negativo, autorizzazione staff/superadmin). Sostituisce il read-modify-write client (audit sicurezza 2026-08).';

REVOKE ALL ON FUNCTION public.fidelity_applica_movimento(uuid, uuid, integer, text, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fidelity_applica_movimento(uuid, uuid, integer, text, text, uuid) TO authenticated, service_role;
