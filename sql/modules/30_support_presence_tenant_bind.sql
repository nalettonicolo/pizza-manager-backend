-- =============================================================================
-- 30) Support presence: tenant SOLO da identità (no trust su p_tenant_id)
-- =============================================================================
-- Correzione sicurezza: un utente autenticato NON può scrivere presence su un
-- tenant arbitrario passato come parametro. p_tenant_id resta in firma per
-- compatibilità client ma viene ignorato.
-- =============================================================================

ALTER TABLE IF EXISTS public.support_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_presence FORCE ROW LEVEL SECURITY;

-- Nessuna scrittura diretta da client (solo RPC SECURITY DEFINER).
DROP POLICY IF EXISTS "support_presence_own_upsert" ON public.support_presence;
DROP POLICY IF EXISTS "support_presence_insert" ON public.support_presence;
DROP POLICY IF EXISTS "support_presence_update" ON public.support_presence;
DROP POLICY IF EXISTS "support_presence_delete" ON public.support_presence;

DROP POLICY IF EXISTS "support_presence_sa_select" ON public.support_presence;
CREATE POLICY "support_presence_sa_select" ON public.support_presence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
        AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
    )
  );

REVOKE ALL ON TABLE public.support_presence FROM PUBLIC;
REVOKE ALL ON TABLE public.support_presence FROM anon, authenticated;
GRANT SELECT ON TABLE public.support_presence TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_support_presence(
  p_path TEXT,
  p_page_label TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_tenant UUID;
  v_ruolo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  -- p_tenant_id è intenzionalmente ignorato (non è un'autorizzazione).
  -- Il tenant deriva solo dall'identità del chiamante.

  SELECT ur.tenant_id, ur.ruolo
  INTO v_tenant, v_ruolo
  FROM public.utenti_ruoli ur
  WHERE ur.user_id = auth.uid()
    AND COALESCE(ur.attivo, true) = true
    AND ur.tenant_id IS NOT NULL
    AND lower(trim(COALESCE(ur.ruolo, ''))) NOT IN ('superadmin', 'super_admin')
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  IF v_tenant IS NULL THEN
    SELECT c.tenant_id, 'cliente'
    INTO v_tenant, v_ruolo
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- Super Admin (senza riga staff tenant) o utente senza membership: no write.
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.support_presence (user_id, tenant_id, path, page_label, ruolo, updated_at)
  VALUES (
    auth.uid(),
    v_tenant,
    left(COALESCE(NULLIF(trim(p_path), ''), '/'), 500),
    NULLIF(trim(COALESCE(p_page_label, '')), ''),
    NULLIF(trim(COALESCE(v_ruolo, '')), ''),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    path = EXCLUDED.path,
    page_label = EXCLUDED.page_label,
    ruolo = COALESCE(EXCLUDED.ruolo, public.support_presence.ruolo),
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.upsert_support_presence(TEXT, TEXT, UUID) IS
  'Heartbeat presence: tenant sempre da auth.uid() (utenti_ruoli/clienti). p_tenant_id ignorato.';

GRANT EXECUTE ON FUNCTION public.upsert_support_presence(TEXT, TEXT, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_support_presence(TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_support_presence(TEXT, TEXT, UUID) FROM anon;

-- sa_list resta invariato (solo superadmin, filtro per tenant richiesto).
COMMENT ON TABLE public.support_presence IS
  'Heartbeat path utenti; scrittura solo via upsert_support_presence (tenant da identità). Lettura SA.';
