
-- =============================================================================
-- 2) core.punti_vendita (multi-sede) + vista public se assente
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.punti_vendita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punti_vendita_tenant ON core.punti_vendita(tenant_id);

ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS consegna_area_poligono JSONB;
COMMENT ON COLUMN core.punti_vendita.consegna_area_poligono IS 'GeoJSON Polygon WGS84; se NULL in checkout si usa parametri_operativi.consegna_area_poligono del tenant.';

DROP VIEW IF EXISTS public.punti_vendita CASCADE;
CREATE VIEW public.punti_vendita AS
  SELECT
    pv.id,
    pv.tenant_id,
    pv.nome,
    pv.slug,
    pv.attivo,
    pv.consegna_area_poligono,
    pv.created_at,
    pv.updated_at
  FROM core.punti_vendita pv
  WHERE pv.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT ON public.punti_vendita TO authenticated;
GRANT SELECT ON public.punti_vendita TO anon;

