-- =============================================================================
-- 33) Sala QA / supporto Super Admin: lettura punti_vendita di qualsiasi tenant
-- =============================================================================
-- La vista membership-only impediva a SA (senza riga utenti_ruoli sul tenant
-- assistito) di vedere PV → cassa/operative vuote nelle finestre di supporto.
-- Idempotente: ricrea la vista con lat/lng + bypass superadmin.

DROP VIEW IF EXISTS public.punti_vendita CASCADE;

CREATE VIEW public.punti_vendita
WITH (security_invoker = true)
AS
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
  WHERE
    EXISTS (
      SELECT 1
      FROM public.utenti_ruoli sa
      WHERE sa.user_id = auth.uid()
        AND lower(trim(COALESCE(sa.ruolo, ''))) IN ('superadmin', 'super_admin')
    )
    OR pv.tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    );

COMMENT ON VIEW public.punti_vendita IS
  'PV del proprio tenant; Super Admin vede tutti i PV (Sala QA / supporto live).';

GRANT SELECT ON public.punti_vendita TO authenticated;
GRANT SELECT ON public.punti_vendita TO anon;
