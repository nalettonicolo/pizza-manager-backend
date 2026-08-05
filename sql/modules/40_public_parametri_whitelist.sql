-- =============================================================================
-- 40) Whitelist parametri_operativi nelle RPC pubbliche (vetrina / anteprima)
-- =============================================================================
-- Security follow-up (punto situazione 07): anon non deve ricevere l’intero blob
-- operativo (cassa, fiscale, notifiche, ecc.). Solo chiavi necessarie a menu,
-- checkout web, area consegna, tema e fidelity vetrina.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_public_parametri_operativi(p_po JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_src JSONB := COALESCE(p_po, '{}'::JSONB);
  v_out JSONB := '{}'::JSONB;
  v_keys TEXT[] := ARRAY[
    'ordini_online_attivi',
    'menuTheme',
    'promozioni_calendario',
    'consegna_area_poligono',
    'consegna_domicilio_attiva',
    'pizze_ogni_15_min',
    'fidelity_attivo',
    'fidelity_abilita_clienti_domicilio',
    'fidelity_modalita_accredito',
    'fidelity_timbri_per_pizza',
    'fidelity_timbri_scheda_totale',
    'fidelity_premi',
    'fidelity_punti_per_euro'
  ];
  k TEXT;
BEGIN
  IF jsonb_typeof(v_src) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::JSONB;
  END IF;
  FOREACH k IN ARRAY v_keys LOOP
    IF v_src ? k THEN
      v_out := v_out || jsonb_build_object(k, v_src -> k);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.pm_public_parametri_operativi(JSONB) IS
  'Sottoinsieme parametri_operativi sicuro per anon/vetrina (mod. 40).';

REVOKE ALL ON FUNCTION public.pm_public_parametri_operativi(JSONB) FROM PUBLIC;
-- Solo uso interno da SECURITY DEFINER pubbliche; non esporre come RPC PostgREST
REVOKE ALL ON FUNCTION public.pm_public_parametri_operativi(JSONB) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_id(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin, pg_temp
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', t.id,
    'nome', t.nome,
    'slug', t.slug,
    'logo_url', t.logo_url,
    'attivo', COALESCE(t.attivo, true),
    'piano', t.piano,
    'parametri_operativi', public.pm_public_parametri_operativi(COALESCE(t.parametri_operativi, '{}'::JSONB)),
    'orari_settimana', t.orari_settimana,
    'indirizzo', t.indirizzo
  )
  INTO v_row
  FROM admin.tenants t
  WHERE t.id = p_tenant_id
    AND COALESCE(t.attivo, true) = true
    AND t.deleted_at IS NULL;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.get_public_tenant_by_id(UUID) IS
  'Anteprima SaaS: branding/tenant attivo per UUID (anon). parametri_operativi filtrati (mod. 40).';

REVOKE ALL ON FUNCTION public.get_public_tenant_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_id(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_by_domain(p_host text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, admin, pg_temp
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      id,
      nome,
      logo_url,
      indirizzo,
      email,
      telefono,
      orari_settimana,
      public.pm_public_parametri_operativi(COALESCE(parametri_operativi, '{}'::JSONB)) AS parametri_operativi,
      legal_ragione_sociale,
      legal_piva,
      legal_pec,
      privacy_policy_html,
      cookie_policy_html,
      pagamento_online_provider,
      stripe_publishable_key,
      sumup_merchant_public_id
    FROM admin.tenants
    WHERE deleted_at IS NULL
      AND (attivo IS NULL OR attivo = true)
      AND (
        (
          public_domain IS NOT NULL
          AND btrim(public_domain) <> ''
          AND lower(btrim(public_domain)) = lower(btrim(p_host))
        )
        OR (
          lower(btrim(p_host)) LIKE '%.pizzamanager.it'
          AND lower(btrim(slug)) = lower(split_part(btrim(p_host), '.', 1))
        )
      )
    LIMIT 1
  ) t;
$$;

COMMENT ON FUNCTION public.resolve_public_tenant_by_domain(text) IS
  'Menu pubblico: tenant da hostname; parametri_operativi filtrati (mod. 40).';

GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_by_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_by_domain(text) TO authenticated;
