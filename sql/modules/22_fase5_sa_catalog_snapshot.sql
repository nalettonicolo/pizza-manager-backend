-- Fase 5: catalogo servizi e piani commerciali Super Admin su DB (multi-dispositivo).

CREATE TABLE IF NOT EXISTS admin.sa_catalog_snapshot (
  snapshot_key TEXT PRIMARY KEY DEFAULT 'default',
  services_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  plans_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE admin.sa_catalog_snapshot IS
  'Snapshot JSON catalogo servizi + piani commerciali (Super Admin). Chiave default: default.';

ALTER TABLE admin.sa_catalog_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_catalog_snapshot_superadmin_all ON admin.sa_catalog_snapshot;
CREATE POLICY sa_catalog_snapshot_superadmin_all ON admin.sa_catalog_snapshot
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
        AND COALESCE(ur.attivo, true) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
        AND COALESCE(ur.attivo, true) = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON admin.sa_catalog_snapshot TO authenticated;

CREATE OR REPLACE FUNCTION public.fiscal_outbox_export_pending_json(p_tenant_id UUID, p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(fo)::jsonb ORDER BY fo.created_at), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT id, kind, status, ordine_id, payload_canonical, provider_key, created_at
    FROM public.fiscal_outbox
    WHERE tenant_id = p_tenant_id
      AND status = 'pending'
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  ) fo;

  RETURN jsonb_build_object('items', v_rows);
END;
$$;

COMMENT ON FUNCTION public.fiscal_outbox_export_pending_json(UUID, INT) IS
  'Export JSON righe fiscal_outbox pending per tenant (staff/superadmin).';

REVOKE ALL ON FUNCTION public.fiscal_outbox_export_pending_json(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_outbox_export_pending_json(UUID, INT) TO authenticated;
