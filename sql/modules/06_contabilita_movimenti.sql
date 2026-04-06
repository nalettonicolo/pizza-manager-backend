
-- =============================================================================
-- 6) ContabilitÃ : movimenti manuali su DB (alternativa / affiancamento a localStorage)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contabilita_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  data_mov DATE NOT NULL,
  descrizione TEXT,
  importo NUMERIC(12, 2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('contanti', 'elettronico')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_movimenti_tenant_data
  ON public.contabilita_movimenti(tenant_id, data_mov DESC);

ALTER TABLE public.contabilita_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabilita_movimenti_staff_all" ON public.contabilita_movimenti;
CREATE POLICY "contabilita_movimenti_staff_all" ON public.contabilita_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_movimenti TO authenticated;

COMMENT ON TABLE public.contabilita_movimenti IS
  'Incassi manuali registrati da Admin (contanti / elettronico); usabile al posto del solo localStorage.';

