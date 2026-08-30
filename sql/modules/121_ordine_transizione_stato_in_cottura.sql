-- Modulo 121 — Matrice transizioni aggiornata con IN_COTTURA (dipende dal modulo 120)
--
-- Flusso confermato con il locale:
--   IN_ATTESA -> IN_PREPARAZIONE -> IN_COTTURA -> (negozio) CONSEGNATO
--                                             \-> (domicilio) PRONTO -> CONSEGNATO
--   ANNULLATO resta l'uscita di emergenza da qualsiasi stato non concluso.
--
-- IN_PREPARAZIONE -> PRONTO resta ammessa per retro-compatibilita (ordini legacy / flussi che
-- non passano dal forno, es. sola bibita). IN_COTTURA -> PRONTO serve al domicilio (il Bancone
-- lo manda in consegna: PRONTO + assegnazione delivery); IN_COTTURA -> CONSEGNATO serve al
-- ritiro in negozio (il Bancone chiude al banco con un solo click).

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
  IF v_stato_nuovo NOT IN ('IN_ATTESA', 'IN_PREPARAZIONE', 'IN_COTTURA', 'PRONTO', 'CONSEGNATO', 'ANNULLATO') THEN
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

  v_valida := CASE v_stato_attuale
    WHEN 'IN_ATTESA' THEN v_stato_nuovo IN ('IN_PREPARAZIONE', 'ANNULLATO')
    WHEN 'IN_PREPARAZIONE' THEN v_stato_nuovo IN ('IN_COTTURA', 'PRONTO', 'ANNULLATO')
    WHEN 'IN_COTTURA' THEN v_stato_nuovo IN ('PRONTO', 'CONSEGNATO', 'ANNULLATO')
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
  'Macchina a stati ordine (IN_ATTESA->IN_PREPARAZIONE->IN_COTTURA->PRONTO/CONSEGNATO). Valida la transizione e registra in cassa_ordine_audit.';
