-- ============================================================================
-- 150 — assert_slot_capacity_for_ordine: capacità forno di default = 8
--        quando pizze_ogni_15_min è nullo, vuoto o 0
-- ----------------------------------------------------------------------------
-- NON APPLICARE SENZA PROVA SU TENANT DI TEST.
-- Scritto, non eseguito: nessuna esecuzione su Supabase è stata fatta.
-- Il numero 149 resta riservato alla restrizione di lettura pony.
--
-- Problema (definizione attuale: modulo 25, righe 65-112; i moduli 93 e 94 non la
-- ridefiniscono, la citano soltanto):
--   v_max := GREATEST(1, ROUND(COALESCE((v_po->>'pizze_ogni_15_min')::NUMERIC, 8))::INT)
--   - valore 0  -> COALESCE non scatta (0 non è NULL) -> v_max = GREATEST(1, 0) = 1:
--                  ogni fascia accetta UNA sola pizza per gli ordini del cliente web.
--   - valore '' -> il cast ''::NUMERIC solleva errore: l'ordine web fallisce.
--   - valore NULL / chiave assente -> già 8 (corretto, invariato).
-- Il frontend usa invece 8 in tutti questi casi:
--   Number(parametri?.pizze_ogni_15_min) || 8
--   (src/features/operative/cassa/utils/slotCapacityUtils.js, riga 8).
-- Quindi la vetrina mostra posto libero e il server rifiuta con slot_forno_pieno.
--
-- Fix: si legge il valore come testo; se è assente, vuoto, non numerico o 0 si usa 8
-- (come `Number(x) || 8`, dove anche un testo non numerico dà NaN -> 8).
-- Numeri validi diversi da 0 restano com'erano (GREATEST(1, ROUND(valore))).
--
-- Cosa NON cambia: firma, tipo di ritorno, STABLE, SECURITY DEFINER, search_path,
-- conteggio delle pizze già presenti, messaggio di errore. CREATE OR REPLACE con la
-- stessa firma mantiene i permessi già impostati dal modulo 35 (solo authenticated).
-- Nessuna tabella, nessun dato toccato: la migrazione non fa DROP né DELETE.
--
-- Fuori perimetro (da proporre a parte): pm_stima_tempo_attesa (modulo 93, riga 49)
-- e pm_valuta_calibrazione_settimanale (modulo 94, riga 92) usano la stessa
-- espressione e hanno lo stesso comportamento con 0 e ''.
--
-- Il controllo vale per gli ordini creati in cassa? NO, solo per i clienti web:
-- create_order_with_items (modulo 105, righe 199-203) chiama la funzione solo se
-- v_is_web_cliente è vero (calcolato alle righe 116-121 da public.clienti). In cassa
-- (staff) non c'è controllo lato server: il limite è solo un avviso a video
-- (RiepilogoOrdinePage.jsx righe 608 e 625: fascia piena = bordo rosso, il pulsante
-- si disabilita solo con `locked`, riga 613; useCassaModificaOrdine.js righe 209-217:
-- campo `over` informativo).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assert_slot_capacity_for_ordine(
  p_tenant_id UUID,
  p_orario_ritiro TEXT,
  p_items JSONB,
  p_parametri JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core, admin
AS $$
DECLARE
  v_slot_key BIGINT;
  v_max INT;
  v_cfg_txt TEXT;
  v_cfg NUMERIC;
  v_existing INT;
  v_new INT;
  v_po JSONB;
BEGIN
  v_slot_key := public.pm_orario_ritiro_to_slot_key(p_orario_ritiro);
  IF v_slot_key IS NULL THEN
    RETURN;
  END IF;

  v_po := COALESCE(p_parametri, '{}'::JSONB);

  -- Come slotCapacityUtils.js: assente, vuoto, non numerico o 0 -> 8.
  v_cfg_txt := NULLIF(trim(COALESCE(v_po->>'pizze_ogni_15_min', '')), '');
  IF v_cfg_txt IS NOT NULL AND v_cfg_txt ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    v_cfg := v_cfg_txt::NUMERIC;
  END IF;
  IF v_cfg IS NULL OR v_cfg = 0 THEN
    v_cfg := 8;
  END IF;
  v_max := GREATEST(1, ROUND(v_cfg))::INT;

  SELECT COALESCE(SUM(ro.quantita), 0)::INT
  INTO v_existing
  FROM core.ordini o
  JOIN core.riga_ordine ro
    ON ro.ordine_id = o.id
   AND ro.tenant_id = o.tenant_id
  WHERE o.tenant_id = p_tenant_id
    AND o.stato::TEXT NOT IN ('ANNULLATO')
    AND (o.created_at AT TIME ZONE 'Europe/Rome')::DATE = (now() AT TIME ZONE 'Europe/Rome')::DATE
    AND public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) = v_slot_key;

  v_new := public.pm_ordine_items_pizze_count(p_items);

  IF v_existing + v_new > v_max THEN
    RAISE EXCEPTION 'slot_forno_pieno: la fascia oraria selezionata ha raggiunto la capacità massima del forno.';
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICA (sola lettura: la funzione è STABLE e il blocco non scrive nulla).
-- Usa un tenant inventato (gen_random_uuid): nessun ordine esistente, quindi
-- conta solo la capacità. Da lanciare PRIMA e DOPO la migrazione, su un
-- database/tenant di test. Atteso DOPO: tutte le righe "OK".
-- Prima della migrazione falliscono i casi con 0 e "" (e "0").
-- ============================================================================
-- DO $$
-- DECLARE
--   r RECORD;
--   v_ok BOOLEAN;
-- BEGIN
--   FOR r IN
--     SELECT * FROM (VALUES
--       ('parametri NULL',        NULL::JSONB,                          8, true),
--       ('parametri NULL',        NULL::JSONB,                          9, false),
--       ('chiave assente',        '{}'::JSONB,                          8, true),
--       ('chiave null',           '{"pizze_ogni_15_min": null}'::JSONB, 8, true),
--       ('stringa vuota',         '{"pizze_ogni_15_min": ""}'::JSONB,   8, true),
--       ('zero numerico',         '{"pizze_ogni_15_min": 0}'::JSONB,    8, true),
--       ('zero come testo',       '{"pizze_ogni_15_min": "0"}'::JSONB,  8, true),
--       ('zero: 9 pizze rifiutate','{"pizze_ogni_15_min": 0}'::JSONB,   9, false),
--       ('valore 12 (invariato)', '{"pizze_ogni_15_min": 12}'::JSONB,  12, true),
--       ('valore 12: 13 rifiutate','{"pizze_ogni_15_min": 12}'::JSONB, 13, false),
--       ('valore 3: 4 rifiutate', '{"pizze_ogni_15_min": 3}'::JSONB,    4, false)
--     ) AS t(caso, params, pizze, atteso_ok)
--   LOOP
--     BEGIN
--       PERFORM public.assert_slot_capacity_for_ordine(
--         gen_random_uuid(), '12:00',
--         jsonb_build_array(jsonb_build_object('quantita', r.pizze)),
--         r.params);
--       v_ok := true;
--     EXCEPTION WHEN OTHERS THEN
--       v_ok := false;
--     END;
--     RAISE NOTICE '% | pizze=% | accettato=% | atteso=% | %',
--       r.caso, r.pizze, v_ok, r.atteso_ok,
--       CASE WHEN v_ok = r.atteso_ok THEN 'OK' ELSE 'ERRORE' END;
--   END LOOP;
-- END $$;

-- ============================================================================
-- ROLLBACK — ripristina la funzione ESATTAMENTE come nel modulo 25 (righe 65-112).
-- Non tocca dati. Per usarlo, togliere i "-- " iniziali ed eseguire.
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.assert_slot_capacity_for_ordine(
--   p_tenant_id UUID,
--   p_orario_ritiro TEXT,
--   p_items JSONB,
--   p_parametri JSONB DEFAULT NULL
-- )
-- RETURNS VOID
-- LANGUAGE plpgsql
-- STABLE
-- SECURITY DEFINER
-- SET search_path = public, core, admin
-- AS $$
-- DECLARE
--   v_slot_key BIGINT;
--   v_max INT;
--   v_existing INT;
--   v_new INT;
--   v_po JSONB;
-- BEGIN
--   v_slot_key := public.pm_orario_ritiro_to_slot_key(p_orario_ritiro);
--   IF v_slot_key IS NULL THEN
--     RETURN;
--   END IF;
--
--   v_po := COALESCE(p_parametri, '{}'::JSONB);
--   v_max := GREATEST(
--     1,
--     ROUND(COALESCE((v_po->>'pizze_ogni_15_min')::NUMERIC, 8))::INT
--   );
--
--   SELECT COALESCE(SUM(ro.quantita), 0)::INT
--   INTO v_existing
--   FROM core.ordini o
--   JOIN core.riga_ordine ro
--     ON ro.ordine_id = o.id
--    AND ro.tenant_id = o.tenant_id
--   WHERE o.tenant_id = p_tenant_id
--     AND o.stato::TEXT NOT IN ('ANNULLATO')
--     AND (o.created_at AT TIME ZONE 'Europe/Rome')::DATE = (now() AT TIME ZONE 'Europe/Rome')::DATE
--     AND public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) = v_slot_key;
--
--   v_new := public.pm_ordine_items_pizze_count(p_items);
--
--   IF v_existing + v_new > v_max THEN
--     RAISE EXCEPTION 'slot_forno_pieno: la fascia oraria selezionata ha raggiunto la capacità massima del forno.';
--   END IF;
-- END;
-- $$;
