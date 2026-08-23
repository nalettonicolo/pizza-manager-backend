-- Modulo 75 — Macchina a stati ordine validata server-side + audit dei cambi di stato.
-- Prima: updateOrderStato() (adminService.js) faceva un .update({stato}) diretto dal client su
-- core.ordini, senza alcun controllo su quale transizione fosse valida — RLS su core.ordini
-- verificava solo l'appartenenza al tenant, non COSA si stava scrivendo: un ordine CONSEGNATO
-- poteva tornare IN_PREPARAZIONE, un ordine ANNULLATO poteva "resuscitare" a PRONTO, senza che
-- nessuna regola lo impedisse. Inoltre nessuna di queste transizioni veniva registrata in
-- cassa_ordine_audit (già usato per altri eventi cassa — annullamento/modifica ordine, listini
-- — ma non per i cambi di stato).
--
-- Applicato in produzione via apply_migration il 2026-08-23.

CREATE OR REPLACE FUNCTION public.ordine_transizione_stato(p_ordine_id uuid, p_stato_nuovo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_stato_attuale text;
  v_stato_nuovo text := upper(trim(COALESCE(p_stato_nuovo, '')));
  v_valida boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;
  IF v_stato_nuovo NOT IN ('IN_ATTESA', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO', 'ANNULLATO') THEN
    RAISE EXCEPTION 'stato_non_valido: %', v_stato_nuovo;
  END IF;

  SELECT o.tenant_id, o.stato::text INTO v_tenant_id, v_stato_attuale
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = v_tenant_id
      AND (ur.attivo IS DISTINCT FROM false)
  ) THEN
    RAISE EXCEPTION 'tenant_forbidden';
  END IF;

  -- Matrice transizioni: solo in avanti nel flusso, più ANNULLATO come uscita di emergenza da
  -- qualsiasi stato non ancora concluso. CONSEGNATO e ANNULLATO sono terminali: da lì non si
  -- torna indietro con questa funzione (un errore vero si corregge con un nuovo ordine, non
  -- riaprendo uno già chiuso).
  v_valida := CASE v_stato_attuale
    WHEN 'IN_ATTESA' THEN v_stato_nuovo IN ('IN_PREPARAZIONE', 'ANNULLATO')
    WHEN 'IN_PREPARAZIONE' THEN v_stato_nuovo IN ('PRONTO', 'ANNULLATO')
    WHEN 'PRONTO' THEN v_stato_nuovo IN ('CONSEGNATO', 'ANNULLATO')
    ELSE false -- CONSEGNATO, ANNULLATO: nessuna transizione ammessa
  END;

  IF NOT v_valida THEN
    RAISE EXCEPTION 'transizione_non_valida: % -> %', v_stato_attuale, v_stato_nuovo;
  END IF;

  UPDATE core.ordini
  SET stato = v_stato_nuovo::core.stato_ordine, updated_at = now()
  WHERE id = p_ordine_id;

  IF to_regclass('public.cassa_ordine_audit') IS NOT NULL THEN
    INSERT INTO public.cassa_ordine_audit (tenant_id, ordine_id, user_id, event_type, payload)
    VALUES (
      v_tenant_id,
      p_ordine_id,
      auth.uid(),
      'stato_cambiato',
      jsonb_build_object('da', v_stato_attuale, 'a', v_stato_nuovo)
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.ordine_transizione_stato(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ordine_transizione_stato(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.ordine_transizione_stato(uuid, text) IS
  'Cambia lo stato di un ordine solo se la transizione è ammessa (macchina a stati server-side); registra l''evento in cassa_ordine_audit.';
