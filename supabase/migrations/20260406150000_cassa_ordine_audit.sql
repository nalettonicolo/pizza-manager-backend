-- Audit operazioni cassa (append-only) per tracciabilità enterprise.
-- Richiede public.utenti_ruoli con staff sul tenant.

CREATE TABLE IF NOT EXISTS public.cassa_ordine_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ordine_id uuid,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cassa_ordine_audit_tenant_created
  ON public.cassa_ordine_audit (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cassa_ordine_audit_ordine
  ON public.cassa_ordine_audit (ordine_id)
  WHERE ordine_id IS NOT NULL;

COMMENT ON TABLE public.cassa_ordine_audit IS
  'Append-only: eventi cassa (ordine creato, errore checkout, aggiornamenti rilevanti).';

ALTER TABLE public.cassa_ordine_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cassa_ordine_audit_select_staff" ON public.cassa_ordine_audit;

CREATE POLICY "cassa_ordine_audit_select_staff"
  ON public.cassa_ordine_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = cassa_ordine_audit.tenant_id
        AND (ur.attivo IS DISTINCT FROM false)
    )
  );

GRANT SELECT ON public.cassa_ordine_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.cassa_audit_log(
  p_tenant_id uuid,
  p_ordine_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND (ur.attivo IS DISTINCT FROM false)
  ) THEN
    RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.cassa_ordine_audit (tenant_id, ordine_id, user_id, event_type, payload)
  VALUES (
    p_tenant_id,
    p_ordine_id,
    auth.uid(),
    trim(p_event_type),
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

ALTER FUNCTION public.cassa_audit_log(uuid, uuid, text, jsonb) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.cassa_audit_log(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_audit_log(uuid, uuid, text, jsonb) TO authenticated;
