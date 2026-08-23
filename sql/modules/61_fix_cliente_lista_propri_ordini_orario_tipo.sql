-- =============================================================================
-- Modulo 61 — Fix bug reale: "structure of query does not match function result type"
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 via MCP apply_migration.
-- =============================================================================
--
-- Segnalato dal cliente: la pagina "Storico ordini" (area cliente) mostrava l'errore Postgres
-- "structure of query does not match function result type" invece della lista ordini.
--
-- Causa: public.cliente_lista_propri_ordini() dichiarava la colonna orario_ritiro come
-- `timestamp with time zone`, ma core.ordini.orario_ritiro è in realtà TEXT (valori come "19:15",
-- spesso modificati a mano da cassa — vedi anche CL-11, stesso campo). Postgres prova un cast
-- implicito text→timestamptz nella proiezione RETURN QUERY: fallisce per qualunque valore che non
-- sia un timestamp valido, cioè praticamente sempre — da qui l'errore visibile al cliente ad ogni
-- apertura dello storico con almeno un ordine con orario.

DROP FUNCTION IF EXISTS public.cliente_lista_propri_ordini(integer, integer);

CREATE FUNCTION public.cliente_lista_propri_ordini(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  numero integer,
  stato text,
  totale numeric,
  tipo_ordine text,
  tipo_pagamento text,
  orario_ritiro text,
  indirizzo_consegna text,
  created_at timestamp with time zone,
  online_payment jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.cliente_lista_propri_ordini(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_lista_propri_ordini(integer, integer) TO authenticated;
