-- Modulo 70 — Fix classificazione categoria in vetrina_slot_carico_oggi
--
-- Trovato controllando la checklist (OW-04): la RPC che dice al checkout pubblico quanto è
-- "carico" ogni fascia oraria (per bloccare nuove prenotazioni oltre la capacità forno) sommava
-- la quantità di TUTTE le righe ordine (pizze, fritti, dolci, bibite insieme), non solo le pizze —
-- stesso identico bug di classificazione già trovato e corretto lato JS in
-- getRigheAggregateByOrdineIds (CA-02, modulo di sessione precedente, non SQL): categorie pizza
-- come "Classiche"/"Speciali"/"Bianche"/"Chiuse" non contengono la parola "pizza" nel nome, quindi
-- un criterio "a inclusione" le classifica male. Qui però è lato server e affligge direttamente il
-- checkout pubblico: una fascia poteva risultare "piena" per colpa di bibite/fritti extra, o
-- viceversa dare per libera una fascia già piena di pizze vere perché il conteggio non
-- discriminava affatto tra categorie.
--
-- Fix: stesso criterio "a esclusione" già usato in JS (escludi solo fritti/dolci/bibite/
-- ingredienti sfusi, fail-open su categoria sconosciuta). Nessun'altra logica cambiata.

CREATE OR REPLACE FUNCTION public.vetrina_slot_carico_oggi(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_ok BOOLEAN := false;
  v_out JSONB := '{}'::JSONB;
BEGIN
  IF p_tenant_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.tenant_id = p_tenant_id
  ) OR EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'tenant_non_autorizzato';
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(s.slot_key::TEXT, s.pizze),
    '{}'::JSONB
  )
  INTO v_out
  FROM (
    SELECT
      public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) AS slot_key,
      COALESCE(SUM(ro.quantita), 0)::INT AS pizze
    FROM core.ordini o
    JOIN core.riga_ordine ro
      ON ro.ordine_id = o.id
     AND ro.tenant_id = o.tenant_id
    LEFT JOIN core.prodotti p ON p.id = ro.prodotto_id
    LEFT JOIN core.categorie c ON c.id = p.categoria_id
    WHERE o.tenant_id = p_tenant_id
      AND o.stato::TEXT NOT IN ('ANNULLATO')
      AND (o.created_at AT TIME ZONE 'Europe/Rome')::DATE = (now() AT TIME ZONE 'Europe/Rome')::DATE
      AND o.orario_ritiro IS NOT NULL
      AND trim(o.orario_ritiro) <> ''
      AND NOT (
        lower(coalesce(c.slug, '') || ' ' || coalesce(c.nome, '')) ~ 'fritt|dolc|bibit|bevand|bevan|ingredient'
      )
    GROUP BY 1
  ) s
  WHERE s.slot_key IS NOT NULL;

  RETURN COALESCE(v_out, '{}'::JSONB);
END;
$function$;
