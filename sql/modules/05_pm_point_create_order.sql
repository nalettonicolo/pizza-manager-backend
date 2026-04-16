
-- =============================================================================
-- 5) pm_point_in_ring + create_order_with_items (poligono + PV + pagamento misto)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_point_in_ring(
  p_lng double precision,
  p_lat double precision,
  p_ring jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $ring$
DECLARE
  n int;
  i int;
  j int;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  inside boolean := false;
BEGIN
  IF p_ring IS NULL OR jsonb_typeof(p_ring) <> 'array' THEN
    RETURN NULL;
  END IF;

  n := jsonb_array_length(p_ring);
  IF n < 4 THEN
    RETURN NULL;
  END IF;

  IF (p_ring->0->>0)::double precision = (p_ring->(n - 1)->>0)::double precision
     AND (p_ring->0->>1)::double precision = (p_ring->(n - 1)->>1)::double precision THEN
    n := n - 1;
  END IF;

  IF n < 3 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..(n - 1) LOOP
    j := (i + 1) % n;
    xi := (p_ring->i->>0)::double precision;
    yi := (p_ring->i->>1)::double precision;
    xj := (p_ring->j->>0)::double precision;
    yj := (p_ring->j->>1)::double precision;
    IF (yi > p_lat) <> (yj > p_lat) THEN
      IF p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi THEN
        inside := NOT inside;
      END IF;
    END IF;
  END LOOP;

  RETURN inside;
END;
$ring$;

COMMENT ON FUNCTION public.pm_point_in_ring(double precision, double precision, jsonb) IS
  'Ray casting: punto [lng,lat] dentro anello poligonale GeoJSON (primo anello).';

DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL,
  p_pagamento_dettaglio JSONB DEFAULT NULL,
  p_punto_vendita_id UUID DEFAULT NULL,
  p_turno_operatori_id INTEGER DEFAULT NULL,
  p_telefono_ritiro TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
  v_has_tenant_access boolean;
  v_is_web_cliente boolean;
  v_turno_pv uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  v_has_tenant_access := false;
  IF to_regproc('public.pm_core_tenant_access(uuid)') IS NOT NULL THEN
    SELECT public.pm_core_tenant_access(p_tenant_id) INTO v_has_tenant_access;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
    ) INTO v_has_tenant_access;
  END IF;

  IF NOT COALESCE(v_has_tenant_access, false) THEN
    RAISE EXCEPTION 'tenant_non_autorizzato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant_id
  ) INTO v_is_web_cliente;

  -- Canale cliente web: limita lo stato iniziale e il tipo ordine per evitare bypass lato client.
  IF v_is_web_cliente THEN
    IF lower(trim(COALESCE(p_tipo_ordine, ''))) NOT IN ('', 'delivery', 'negozio') THEN
      RAISE EXCEPTION 'tipo_ordine_non_valido';
    END IF;
    IF upper(trim(COALESCE(p_stato, 'IN_PREPARAZIONE'))) NOT IN ('IN_PREPARAZIONE') THEN
      RAISE EXCEPTION 'stato_ordine_non_valido';
    END IF;
  END IF;

  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  v_po := NULL;
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('core.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM core.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna è fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  IF p_turno_operatori_id IS NOT NULL THEN
    IF to_regclass('public.turni_operatori') IS NULL THEN
      RAISE EXCEPTION 'turni_operatori non disponibile sul database';
    END IF;
    SELECT t.punto_vendita_id INTO v_turno_pv
    FROM public.turni_operatori t
    WHERE t.id = p_turno_operatori_id
      AND t.tenant_id = p_tenant_id
      AND t.user_id = auth.uid()
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'turno_non_valido';
    END IF;
    IF p_punto_vendita_id IS NOT NULL AND v_turno_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_punto_vendita_mismatch';
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id,
    turno_operatori_id
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_telefono_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id,
    p_turno_operatori_id
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) IS
  'Crea ordine + righe. Delivery+poligono: clienti con lng/lat in area; staff cassa esentato. Opzionale pagamento_dettaglio JSONB, punto_vendita_id, turno_operatori_id (turno aperto cassa).';

-- =============================================================================
-- replace_order_items — modifica righe ordine (cassa), stesso contratto di sql_upgrade.sql
-- =============================================================================

DROP FUNCTION IF EXISTS public.replace_order_items(UUID, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.replace_order_items(
  p_ordine_id UUID,
  p_totale NUMERIC,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $rep$
DECLARE
  v_tenant_id UUID;
  v_stato core.stato_ordine;
  v_item JSONB;
  v_is_staff_cassa BOOLEAN;
  v_pid UUID;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id, o.stato INTO v_tenant_id, v_stato
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  IF v_stato = 'ANNULLATO'::core.stato_ordine THEN
    RAISE EXCEPTION 'ordine_annullato_non_modificabile';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_is_staff_cassa;

  IF NOT v_is_staff_cassa THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'almeno_una_riga';
  END IF;

  DELETE FROM core.riga_ordine
  WHERE ordine_id = p_ordine_id
    AND tenant_id = v_tenant_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := NULL;
    BEGIN
      v_pid := (v_item->>'prodotto_id')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'prodotto_id_non_valido';
    END;

    IF v_pid IS NULL THEN
      RAISE EXCEPTION 'prodotto_id_obbligatorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM core.prodotti p
      WHERE p.id = v_pid
        AND p.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'prodotto_non_valido';
    END IF;

    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      v_tenant_id,
      p_ordine_id,
      v_pid,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(
        trim(COALESCE(v_item->>'formato_nome', v_item->>'formatoNome', '')),
        ''
      ),
      NULLIF(
        trim(
          COALESCE(
            v_item->>'ingredienti_cottura_summary',
            v_item->>'ingredientiCotturaSummary',
            ''
          )
        ),
        ''
      )
    );
  END LOOP;

  UPDATE core.ordini
  SET
    totale = p_totale,
    updated_at = now(),
    cucina_prep_stato = '{}'::jsonb
  WHERE id = p_ordine_id
    AND tenant_id = v_tenant_id;
END;
$rep$;

GRANT EXECUTE ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) TO authenticated;

COMMENT ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) IS
  'Cassa: sostituisce righe ordine, ricalcola totale, azzera cucina_prep_stato (nuovi id riga).';

