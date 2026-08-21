-- =============================================================================
-- 49) Vetrina: dati per «Modifica pizza» (cliente / anon autenticato in checkout)
-- =============================================================================
-- ModificaPizzaModal in cassa usa viste staff (RLS current_tenant). In vetrina il
-- cliente non ha quel contesto → serve bundle SECURITY DEFINER, solo prodotti
-- visibili online del tenant richiesto.

CREATE OR REPLACE FUNCTION public.get_public_modifica_pizza_bundle(
  p_tenant_id UUID,
  p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_ok BOOLEAN;
  v_recipe JSONB;
  v_all JSONB;
  v_impasti JSONB;
  v_formati JSONB;
  v_cottura JSONB;
BEGIN
  IF p_tenant_id IS NULL OR p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM core.prodotti p
    WHERE p.id = p_product_id
      AND p.tenant_id = p_tenant_id
      AND p.deleted_at IS NULL
      AND (p.attivo = true OR p.attivo IS NULL)
      AND (p.visibile_online = true OR p.visibile_online IS NULL)
  )
  INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'nome', i.nome,
        'va_in_cottura', coalesce(i.va_in_cottura, false),
        'vaInCottura', coalesce(i.va_in_cottura, false),
        'prep_cucina', coalesce(i.prep_cucina, false),
        'prepCucina', coalesce(i.prep_cucina, false),
        'costo_senza', coalesce(i.costo_senza, 0),
        'costo_poco', coalesce(i.costo_poco, 0),
        'costo_abbondante', coalesce(i.costo_abbondante, 0),
        'costo_unitario', coalesce(i.costo_unitario, 0),
        'ordine', pi.ordine
      )
      ORDER BY pi.ordine NULLS LAST, lower(btrim(i.nome))
    ),
    '[]'::jsonb
  )
  INTO v_recipe
  FROM core.prodotto_ingrediente pi
  INNER JOIN core.ingredienti i
    ON i.id = pi.ingrediente_id
   AND i.tenant_id = pi.tenant_id
  WHERE pi.tenant_id = p_tenant_id
    AND pi.prodotto_id = p_product_id
    AND i.deleted_at IS NULL;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'nome', i.nome,
        'va_in_cottura', coalesce(i.va_in_cottura, false),
        'vaInCottura', coalesce(i.va_in_cottura, false),
        'prep_cucina', coalesce(i.prep_cucina, false),
        'prepCucina', coalesce(i.prep_cucina, false),
        'costo_senza', coalesce(i.costo_senza, 0),
        'costo_poco', coalesce(i.costo_poco, 0),
        'costo_abbondante', coalesce(i.costo_abbondante, 0),
        'costo_unitario', coalesce(i.costo_unitario, 0),
        'attivo', coalesce(i.attivo, true)
      )
      ORDER BY lower(btrim(i.nome))
    ),
    '[]'::jsonb
  )
  INTO v_all
  FROM core.ingredienti i
  WHERE i.tenant_id = p_tenant_id
    AND i.deleted_at IS NULL
    AND (i.attivo = true OR i.attivo IS NULL);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'nome', x.nome,
        'attivo', coalesce(x.attivo, true),
        'prezzo', coalesce(x.costo_base, 0),
        'costo_base', coalesce(x.costo_base, 0)
      )
      ORDER BY lower(btrim(x.nome))
    ),
    '[]'::jsonb
  )
  INTO v_impasti
  FROM core.impasti x
  WHERE x.tenant_id = p_tenant_id
    AND (x.attivo = true OR x.attivo IS NULL);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'nome', x.nome,
        'attivo', coalesce(x.attivo, true),
        'prezzo', coalesce(x.prezzo, 0)
      )
      ORDER BY lower(btrim(x.nome))
    ),
    '[]'::jsonb
  )
  INTO v_formati
  FROM core.formati x
  WHERE x.tenant_id = p_tenant_id
    AND (x.attivo = true OR x.attivo IS NULL);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'nome', x.nome,
        'attivo', coalesce(x.attivo, true)
      )
      ORDER BY lower(btrim(x.nome))
    ),
    '[]'::jsonb
  )
  INTO v_cottura
  FROM core.cottura x
  WHERE x.tenant_id = p_tenant_id
    AND (x.attivo = true OR x.attivo IS NULL);

  RETURN jsonb_build_object(
    'product_ingredienti', coalesce(v_recipe, '[]'::jsonb),
    'ingredienti', coalesce(v_all, '[]'::jsonb),
    'impasti', coalesce(v_impasti, '[]'::jsonb),
    'formati', coalesce(v_formati, '[]'::jsonb),
    'cottura', coalesce(v_cottura, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_public_modifica_pizza_bundle(UUID, UUID) IS
  'Vetrina: ricetta + cataloghi per Modifica pizza (solo prodotto attivo/visibile online).';

GRANT EXECUTE ON FUNCTION public.get_public_modifica_pizza_bundle(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_modifica_pizza_bundle(UUID, UUID) TO authenticated;
