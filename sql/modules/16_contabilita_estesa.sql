
-- =============================================================================
-- 16) Contabilità tenant: fatture passive, spese, pagamenti fatture
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contabilita_fatture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  data_doc DATE NOT NULL,
  fornitore TEXT DEFAULT '',
  riferimento_ddt TEXT DEFAULT '',
  importo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_fatture_tenant
  ON public.contabilita_fatture(tenant_id, data_doc DESC);

CREATE TABLE IF NOT EXISTS public.contabilita_spese (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ambito TEXT NOT NULL CHECK (ambito IN ('locale', 'personale')),
  data_spesa DATE NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'altro',
  importo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_spese_tenant
  ON public.contabilita_spese(tenant_id, ambito, data_spesa DESC);

CREATE TABLE IF NOT EXISTS public.contabilita_pagamenti_fatture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  fattura_numero TEXT NOT NULL,
  scadenza DATE NOT NULL,
  tipo_pagamento TEXT NOT NULL DEFAULT 'bonifico',
  pagato BOOLEAN NOT NULL DEFAULT false,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_pagamenti_tenant
  ON public.contabilita_pagamenti_fatture(tenant_id, scadenza DESC);

ALTER TABLE public.contabilita_fatture ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabilita_spese ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabilita_pagamenti_fatture ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabilita_fatture_staff_all" ON public.contabilita_fatture;
CREATE POLICY "contabilita_fatture_staff_all" ON public.contabilita_fatture
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "contabilita_spese_staff_all" ON public.contabilita_spese;
CREATE POLICY "contabilita_spese_staff_all" ON public.contabilita_spese
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "contabilita_pagamenti_staff_all" ON public.contabilita_pagamenti_fatture;
CREATE POLICY "contabilita_pagamenti_staff_all" ON public.contabilita_pagamenti_fatture
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_fatture TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_spese TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_pagamenti_fatture TO authenticated;

COMMENT ON TABLE public.contabilita_fatture IS 'Fatture passive collegate ai DDT magazzino.';
COMMENT ON TABLE public.contabilita_spese IS 'Spese struttura (ambito locale o personale).';
COMMENT ON TABLE public.contabilita_pagamenti_fatture IS 'Scadenze e stato pagamento fatture fornitori.';

CREATE TABLE IF NOT EXISTS public.contabilita_foodcost_manuali (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ingrediente TEXT NOT NULL,
  costo_al_kg NUMERIC(12, 4) NOT NULL DEFAULT 0,
  peso_teorico_g NUMERIC(12, 2) NOT NULL DEFAULT 0,
  prezzo_vendita NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_foodcost_tenant
  ON public.contabilita_foodcost_manuali(tenant_id, created_at DESC);

ALTER TABLE public.contabilita_foodcost_manuali ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabilita_foodcost_staff_all" ON public.contabilita_foodcost_manuali;
CREATE POLICY "contabilita_foodcost_staff_all" ON public.contabilita_foodcost_manuali
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_foodcost_manuali TO authenticated;

COMMENT ON TABLE public.contabilita_foodcost_manuali IS 'Analisi food cost manuali per ingrediente (oltre al calcolo automatico da listino).';
