-- =============================================================================
-- 37 — Storage privato per proof of delivery (firma/foto)
-- =============================================================================
-- Bucket: consegna-prove (privato)
-- Path: {tenant_id}/{ordine_id}/{tipo}-{ts}.{ext}
-- Policy: solo staff del tenant (utenti_ruoli) o superadmin.
-- Idempotente.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consegna-prove',
  'consegna-prove',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.pm_storage_path_tenant_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_seg TEXT := NULLIF(split_part(COALESCE(object_name, ''), '/', 1), '');
BEGIN
  IF v_seg IS NULL OR v_seg !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN v_seg::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.pm_storage_path_tenant_id(TEXT) IS
  'Estrae tenant_id dal primo segmento path Storage (consegna-prove / staff-hr).';

DROP POLICY IF EXISTS "consegna_prove_select_staff" ON storage.objects;
CREATE POLICY "consegna_prove_select_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'consegna-prove'
    AND (
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
          AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
      )
      OR public.pm_storage_path_tenant_id(name) IN (
        SELECT ur.tenant_id
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "consegna_prove_insert_staff" ON storage.objects;
CREATE POLICY "consegna_prove_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consegna-prove'
    AND (
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
          AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
      )
      OR public.pm_storage_path_tenant_id(name) IN (
        SELECT ur.tenant_id
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "consegna_prove_update_staff" ON storage.objects;
CREATE POLICY "consegna_prove_update_staff" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'consegna-prove'
    AND (
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
          AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
      )
      OR public.pm_storage_path_tenant_id(name) IN (
        SELECT ur.tenant_id
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
      )
    )
  )
  WITH CHECK (
    bucket_id = 'consegna-prove'
    AND (
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
          AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
      )
      OR public.pm_storage_path_tenant_id(name) IN (
        SELECT ur.tenant_id
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "consegna_prove_delete_staff" ON storage.objects;
CREATE POLICY "consegna_prove_delete_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'consegna-prove'
    AND (
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
          AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
      )
      OR public.pm_storage_path_tenant_id(name) IN (
        SELECT ur.tenant_id
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND COALESCE(ur.attivo, true) = true
      )
    )
  );
