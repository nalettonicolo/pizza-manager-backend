-- Cliente autenticato: storico ordini vetrina (solo propri ordini web, tenant-safe).

CREATE OR REPLACE FUNCTION public.cliente_lista_propri_ordini(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  numero integer,
  stato text,
  totale numeric,
  tipo_ordine text,
  tipo_pagamento text,
  orario_ritiro timestamptz,
  indirizzo_consegna text,
  created_at timestamptz,
  online_payment jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;

  SELECT c.tenant_id INTO v_tenant
  FROM public.clienti c
  WHERE c.id = v_uid;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Profilo cliente non trovato' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.numero,
    o.stato::text,
    o.totale,
    o.tipo_ordine::text,
    o.tipo_pagamento::text,
    o.orario_ritiro,
    o.indirizzo_consegna,
    o.created_at,
    o.online_payment
  FROM core.ordini o
  WHERE o.tenant_id = v_tenant
    AND o.web_cliente_user_id = v_uid
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

COMMENT ON FUNCTION public.cliente_lista_propri_ordini(integer, integer) IS
  'Elenco ordini web del cliente autenticato (web_cliente_user_id = auth.uid()) nel proprio tenant.';

REVOKE ALL ON FUNCTION public.cliente_lista_propri_ordini(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_lista_propri_ordini(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.cliente_dettaglio_proprio_ordine(p_ordine_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_ordine jsonb;
  v_righe jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'Ordine non valido' USING ERRCODE = '22023';
  END IF;

  SELECT c.tenant_id INTO v_tenant
  FROM public.clienti c
  WHERE c.id = v_uid;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Profilo cliente non trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'numero', o.numero,
    'stato', o.stato,
    'totale', o.totale,
    'note', o.note,
    'tipo_ordine', o.tipo_ordine,
    'tipo_pagamento', o.tipo_pagamento,
    'orario_ritiro', o.orario_ritiro,
    'indirizzo_consegna', o.indirizzo_consegna,
    'telefono_ritiro', o.telefono_ritiro,
    'nome_cliente', o.nome_cliente,
    'online_payment', o.online_payment,
    'stato_consegna', o.stato_consegna,
    'created_at', o.created_at
  )
  INTO v_ordine
  FROM core.ordini o
  WHERE o.id = p_ordine_id
    AND o.tenant_id = v_tenant
    AND o.web_cliente_user_id = v_uid
    AND o.deleted_at IS NULL;

  IF v_ordine IS NULL THEN
    RAISE EXCEPTION 'Ordine non trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'prodotto_id', r.prodotto_id,
        'prodotto_nome', p.nome,
        'quantita', r.quantita,
        'prezzo', r.prezzo,
        'formato_nome', r.formato_nome,
        'ingredienti_cottura_summary', r.ingredienti_cottura_summary
      )
      ORDER BY r.id
    ),
    '[]'::jsonb
  )
  INTO v_righe
  FROM core.riga_ordine r
  LEFT JOIN core.prodotti p ON p.id = r.prodotto_id AND p.tenant_id = r.tenant_id
  WHERE r.ordine_id = p_ordine_id
    AND r.tenant_id = v_tenant;

  RETURN v_ordine || jsonb_build_object('righe', v_righe);
END;
$$;

COMMENT ON FUNCTION public.cliente_dettaglio_proprio_ordine(uuid) IS
  'Dettaglio ordine + righe per cliente autenticato; solo ordini web propri.';

REVOKE ALL ON FUNCTION public.cliente_dettaglio_proprio_ordine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_dettaglio_proprio_ordine(uuid) TO authenticated;
