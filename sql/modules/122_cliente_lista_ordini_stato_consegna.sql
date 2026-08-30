-- Modulo 122 — cliente_lista_propri_ordini: aggiunge stato_consegna
--
-- Serve alla notifica "In consegna" lato cliente: quando il rider prende in carico la consegna
-- (stato_consegna = IN_VIAGGIO) lo stato ordine top-level resta PRONTO, quindi senza questo campo
-- il cliente continuava a vedere "Pronto". Esponendo stato_consegna la pagina "I miei ordini"
-- mostra "In consegna" appena il rider parte. Mantiene identica la firma/ordine colonne del
-- modulo 61, aggiungendo stato_consegna in coda (retro-compatibile: i client leggono per nome).

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
  online_payment jsonb,
  stato_consegna text
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
    o.online_payment,
    o.stato_consegna::text
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
