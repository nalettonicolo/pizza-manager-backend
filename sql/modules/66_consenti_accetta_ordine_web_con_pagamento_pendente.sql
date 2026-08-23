-- Modulo 66 — "Accetta" ordine web permesso anche con pagamento online non ancora concluso
--
-- Richiesta esplicita dell'utente: il blocco introdotto nei moduli 64/65 (staff_accetta_ordine_web
-- rifiutava l'accettazione se il pagamento online non risultava "succeeded") va rimosso —
-- l'operatore deve poter accettare comunque l'ordine in cucina. L'eventuale mancato pagamento è già
-- coperto dall'auto-conversione lato Cassa (CassaPage.jsx) che passa da sola l'ordine a "da pagare
-- alla consegna" a 20 minuti dall'orario previsto, o subito se il provider segnala un fallimento
-- esplicito (vedi modulo di riferimento CL-11 in checklistModificheMese.js).
--
-- Fix: rimossa la sola sezione che faceva RAISE EXCEPTION sul pagamento pendente. Nessun'altra
-- logica modificata (permessi, note, cambio stato) rispetto alla versione precedente.

CREATE OR REPLACE FUNCTION public.staff_accetta_ordine_web(p_ordine_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ord core.ordini%ROWTYPE;
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_obbligatorio';
  END IF;

  SELECT * INTO v_ord FROM core.ordini WHERE id = p_ordine_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = v_uid
      AND ur.tenant_id = v_ord.tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) IN ('cassa', 'admin', 'owner', 'superadmin')
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'permesso_negato' USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE(v_ord.richiede_accettazione_cassa, false) THEN
    RETURN jsonb_build_object('ok', true, 'già_accettato', true, 'ordine_id', v_ord.id, 'stato', v_ord.stato);
  END IF;

  UPDATE core.ordini
  SET
    stato = 'IN_PREPARAZIONE'::core.stato_ordine,
    richiede_accettazione_cassa = false,
    note = trim(BOTH ' ·' FROM regexp_replace(
      COALESCE(note, ''),
      '\s*·\s*Ordine web\s*·\s*in attesa accettazione cassa',
      '',
      'i'
    )),
    updated_at = now()
  WHERE id = p_ordine_id;

  RETURN jsonb_build_object('ok', true, 'già_accettato', false, 'ordine_id', p_ordine_id, 'stato', 'IN_PREPARAZIONE');
END;
$function$;
