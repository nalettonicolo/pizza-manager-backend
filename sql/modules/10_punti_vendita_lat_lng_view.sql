
-- =============================================================================
-- 8) punti_vendita: coordinate sede (centro mappa / marcatore area consegna)
-- =============================================================================

ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
COMMENT ON COLUMN core.punti_vendita.lat IS 'Latitudine sede (centro mappa e marcatore in admin aree consegna).';
COMMENT ON COLUMN core.punti_vendita.lng IS 'Longitudine sede (centro mappa e marcatore in admin aree consegna).';

DROP VIEW IF EXISTS public.punti_vendita CASCADE;
CREATE VIEW public.punti_vendita AS
  SELECT
    pv.id,
    pv.tenant_id,
    pv.nome,
    pv.slug,
    pv.attivo,
    pv.consegna_area_poligono,
    pv.lat,
    pv.lng,
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
