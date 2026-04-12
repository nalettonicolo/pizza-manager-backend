
-- =============================================================================
-- 7) Magazzino: movimenti di magazzino (base incrementale)
-- Canonico anche in sql/sql_upgrade.sql (blocco moduli) e schema_completo (append).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.magazzino_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  prodotto_id UUID,
  descrizione TEXT NOT NULL,
  qty_delta NUMERIC(14, 3) NOT NULL,
  unita TEXT DEFAULT 'pz',
  riferimento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magazzino_movimenti_tenant ON public.magazzino_movimenti(tenant_id, created_at DESC);

ALTER TABLE public.magazzino_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magazzino_movimenti_staff_all" ON public.magazzino_movimenti;
CREATE POLICY "magazzino_movimenti_staff_all" ON public.magazzino_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazzino_movimenti TO authenticated;

COMMENT ON TABLE public.magazzino_movimenti IS
  'Movimenti di carico/scarico; prodotto_id opzionale se il movimento è aggregato o non legato al listino.';
