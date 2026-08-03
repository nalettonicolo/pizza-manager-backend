-- =============================================================================
-- 26) Support presence: dove sta lavorando staff/cliente (visione SA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.support_presence (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  path TEXT NOT NULL DEFAULT '/',
  page_label TEXT,
  ruolo TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_support_presence_tenant_updated
  ON public.support_presence (tenant_id, updated_at DESC);

ALTER TABLE public.support_presence ENABLE ROW LEVEL SECURITY;

-- Nessun client deve modificare direttamente questa tabella. La scrittura passa
-- unicamente dalla RPC qui sotto, che ricava il tenant da auth.uid().
DROP POLICY IF EXISTS "support_presence_own_upsert" ON public.support_presence;

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
  v_is_superadmin BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) INTO v_is_superadmin;

  -- p_tenant_id non e' un'autorizzazione: per staff/clienti deve coincidere
  -- con il tenant associato a auth.uid(). Solo il Super Admin puo' scegliere
  -- un tenant per l'assistenza QA, dopo averne verificato l'esistenza.
  IF p_tenant_id IS NOT NULL AND v_is_superadmin THEN
    PERFORM 1 FROM core.tenants t WHERE t.id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'tenant_non_trovato';
    END IF;
    v_tenant := p_tenant_id;
    v_ruolo := 'superadmin';
  ELSIF p_tenant_id IS NOT NULL THEN
    SELECT ur.tenant_id, ur.ruolo
    INTO v_tenant, v_ruolo
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
    LIMIT 1;

    IF v_tenant IS NULL THEN
      SELECT c.tenant_id, 'cliente'
      INTO v_tenant, v_ruolo
      FROM public.clienti c
      WHERE c.id = auth.uid() AND c.tenant_id = p_tenant_id
      LIMIT 1;
    END IF;

    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'tenant_non_autorizzato';
    END IF;
  ELSE
    SELECT ur.tenant_id, ur.ruolo
    INTO v_tenant, v_ruolo
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) NOT IN ('superadmin', 'super_admin')
    LIMIT 1;

    IF v_tenant IS NULL THEN
      SELECT c.tenant_id, 'cliente'
      INTO v_tenant, v_ruolo
      FROM public.clienti c
      WHERE c.id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;

  IF v_tenant IS NULL THEN
    RETURN; -- superadmin senza tenant: non pubblicare presence
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

GRANT EXECUTE ON FUNCTION public.upsert_support_presence(TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.sa_list_support_presence(
  p_tenant_id UUID,
  p_max_age_seconds INTEGER DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_ok BOOLEAN := false;
  v_age INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'solo_superadmin';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;

  v_age := GREATEST(30, LEAST(COALESCE(p_max_age_seconds, 180), 3600));

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', sp.user_id,
          'path', sp.path,
          'page_label', sp.page_label,
          'ruolo', sp.ruolo,
          'updated_at', sp.updated_at
        )
        ORDER BY sp.updated_at DESC
      )
      FROM public.support_presence sp
      WHERE sp.tenant_id = p_tenant_id
        AND sp.updated_at > now() - make_interval(secs => v_age)
    ),
    '[]'::JSONB
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sa_list_support_presence(UUID, INTEGER) TO authenticated;

COMMENT ON TABLE public.support_presence IS
  'Heartbeat path corrente utenti autenticati; Super Admin legge per supporto live.';
