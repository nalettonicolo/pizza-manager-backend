-- Modulo 65 — Messaggio più chiaro quando l'accettazione ordine web è bloccata da pagamento pendente
--
-- Segnalato dall'utente: ordine web con pagamento online scelto dal cliente (es. "Carta (Stripe —
-- in attesa)") ma mai completato (il pagamento non è mai arrivato a "succeeded" — es. la carta non
-- è stata inserita, o l'integrazione Stripe/SumUp non era ancora configurata correttamente, vedi
-- moduli 63/64). Cliccando "Accetta" in Cassa, il blocco introdotto nel modulo 64 è corretto (non
-- si deve mandare in cucina un ordine il cui pagamento online non è mai arrivato), ma il messaggio
-- non indicava la via di sblocco già presente in Cassa: il pulsante "Segna come pagato" (scegliendo
-- Contanti o Carta) aggiorna tipo_pagamento e rimuove il blocco, per i casi in cui il cliente pagherà
-- comunque alla consegna nonostante il tentativo di pagamento online non riuscito.
--
-- Nessun cambio di logica: solo il testo del messaggio di errore, per guidare l'operatore invece di
-- limitarsi a vietare l'azione.

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
  v_pay TEXT;
  v_op_status TEXT;
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

  v_pay := lower(trim(COALESCE(v_ord.tipo_pagamento, '')));
  v_op_status := lower(trim(COALESCE(v_ord.online_payment->>'status', '')));
  IF v_op_status IS DISTINCT FROM 'succeeded'
     AND (
       v_pay LIKE '%in attesa%'
       OR (v_pay LIKE '%stripe%' AND v_pay NOT LIKE '%pagato%')
       OR (v_pay LIKE '%sumup%' AND v_pay NOT LIKE '%pagato%')
     )
  THEN
    RAISE EXCEPTION 'Il pagamento online non risulta ancora completato. Verifica lo stato con il provider, oppure usa «Segna come pagato» (Contanti/Carta) se il cliente pagherà alla consegna, poi riprova ad accettare.'
      USING ERRCODE = 'P0001';
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
