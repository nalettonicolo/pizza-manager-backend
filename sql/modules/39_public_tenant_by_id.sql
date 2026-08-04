-- =============================================================================
-- 39) Tenant pubblico per anteprima SaaS (/preview, /negozio)
-- =============================================================================
-- Dopo hardening, anon non legge più public.tenants (RLS pm_core_tenant_access).
-- La vetrina risolve il tenant via UUID (env / ?tenant= / support_tenant) ma
-- .from('tenants') torna vuoto → menu vuoto. RPC DEFINER espone solo campi safe.
-- =============================================================================

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
    'parametri_operativi', COALESCE(t.parametri_operativi, '{}'::JSONB),
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
  'Anteprima SaaS: branding/tenant attivo per UUID (anon). Solo campi pubblici.';

REVOKE ALL ON FUNCTION public.get_public_tenant_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_id(UUID) TO anon, authenticated;
