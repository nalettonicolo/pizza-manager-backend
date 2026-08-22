-- =============================================================================
-- Modulo 57 — Fix ordine ingredienti sulla vetrina pubblica (alfabetico invece che ricetta)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 come
-- "fix_get_public_menu_ingredient_names_order".
-- =============================================================================
--
-- Bug trovato in backtest live: sulla vetrina pubblica gli ingredienti di ogni pizza
-- comparivano in ordine alfabetico (es. Capricciosa: "Carciofi, Funghi, Mozzarella,
-- Pomodoro, Prosciutto cotto") invece dell'ordine di ricetta ("Pomodoro, Mozzarella,
-- Prosciutto cotto, Funghi, Carciofi", corretto e coerente con quanto già mostrato in Cassa).
--
-- Causa: get_public_menu_ingredient_names() aggregava con
-- array_agg(...) ORDER BY lower(btrim(i.nome)) invece di ORDER BY pi.ordine — verificato
-- che i dati in core.prodotto_ingrediente.ordine sono corretti (0,1,2,3,4 per Capricciosa),
-- era solo l'aggregazione SQL a ignorarli e ordinare per nome.

CREATE OR REPLACE FUNCTION public.get_public_menu_ingredient_names(p_tenant_id uuid, p_product_ids uuid[])
 RETURNS TABLE(prodotto_id uuid, nomi text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'core'
AS $function$
  SELECT
    pi.prodotto_id,
    coalesce(
      array_agg(btrim(i.nome) ORDER BY pi.ordine NULLS LAST, lower(btrim(i.nome)))
        FILTER (WHERE i.nome IS NOT NULL AND btrim(i.nome) <> ''),
      '{}'::text[]
    ) AS nomi
  FROM core.prodotto_ingrediente pi
  INNER JOIN core.ingredienti i
    ON i.id = pi.ingrediente_id
   AND i.tenant_id = pi.tenant_id
  INNER JOIN core.prodotti p
    ON p.id = pi.prodotto_id
   AND p.tenant_id = pi.tenant_id
  WHERE pi.tenant_id = p_tenant_id
    AND p_product_ids IS NOT NULL
    AND cardinality(p_product_ids) >= 1
    AND pi.prodotto_id = ANY(p_product_ids)
    AND p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL)
    AND i.deleted_at IS NULL
  GROUP BY pi.prodotto_id;
$function$;
