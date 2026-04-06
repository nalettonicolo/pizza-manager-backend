-- =============================================================================
-- 1) FIDELITY + DEFAULT PARAMETRI TENANT
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fidelity_saldi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica_cliente_id UUID NOT NULL REFERENCES public.anagrafica_clienti(id) ON DELETE CASCADE,
  punti INT NOT NULL DEFAULT 0,
  codice_carta TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fidelity_saldi_tenant_cliente_unique UNIQUE (tenant_id, anagrafica_cliente_id),
  CONSTRAINT fidelity_saldi_tenant_codice_unique UNIQUE (tenant_id, codice_carta),
  CONSTRAINT fidelity_saldi_punti_non_neg CHECK (punti >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fidelity_saldi_tenant ON public.fidelity_saldi(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fidelity_saldi_anagrafica ON public.fidelity_saldi(anagrafica_cliente_id);

CREATE TABLE IF NOT EXISTS public.fidelity_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica_cliente_id UUID NOT NULL REFERENCES public.anagrafica_clienti(id) ON DELETE CASCADE,
  punti INT NOT NULL,
  tipo TEXT NOT NULL,
  ordine_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fidelity_movimenti_tenant_cliente
  ON public.fidelity_movimenti(tenant_id, anagrafica_cliente_id, created_at DESC);

ALTER TABLE public.fidelity_saldi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelity_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fidelity_saldi_staff_all" ON public.fidelity_saldi;
CREATE POLICY "fidelity_saldi_staff_all" ON public.fidelity_saldi
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "fidelity_movimenti_staff_all" ON public.fidelity_movimenti;
DROP POLICY IF EXISTS "fidelity_movimenti_staff_select" ON public.fidelity_movimenti;
DROP POLICY IF EXISTS "fidelity_movimenti_staff_insert" ON public.fidelity_movimenti;
CREATE POLICY "fidelity_movimenti_staff_select" ON public.fidelity_movimenti
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );
CREATE POLICY "fidelity_movimenti_staff_insert" ON public.fidelity_movimenti
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidelity_saldi TO authenticated;
GRANT SELECT, INSERT ON public.fidelity_movimenti TO authenticated;

COMMENT ON TABLE public.fidelity_saldi IS 'Punti fidelity per cliente anagrafica (cassa); codice_carta univoco per tenant.';
COMMENT ON TABLE public.fidelity_movimenti IS 'Storico variazioni punti (manuale, ordine, ecc.).';

ALTER TABLE public.fidelity_saldi
  ADD COLUMN IF NOT EXISTS nome_negozio TEXT;

COMMENT ON COLUMN public.fidelity_saldi.nome_negozio IS
  'Nome come lo chiami in negozio (bancone); opzionale, affiancato al codice carta.';

UPDATE core.tenants t
SET parametri_operativi =
  COALESCE(t.parametri_operativi, '{}'::jsonb)
  || jsonb_build_object(
    'consegna_domicilio_attiva',
    CASE
      WHEN COALESCE(t.parametri_operativi, '{}'::jsonb) ? 'consegna_domicilio_attiva'
        THEN (COALESCE(t.parametri_operativi, '{}'::jsonb)->>'consegna_domicilio_attiva')::boolean
      ELSE true
    END,
    'fidelity_abilita_clienti_domicilio',
    CASE
      WHEN COALESCE(t.parametri_operativi, '{}'::jsonb) ? 'fidelity_abilita_clienti_domicilio'
        THEN (COALESCE(t.parametri_operativi, '{}'::jsonb)->>'fidelity_abilita_clienti_domicilio')::boolean
      ELSE true
    END
  );

