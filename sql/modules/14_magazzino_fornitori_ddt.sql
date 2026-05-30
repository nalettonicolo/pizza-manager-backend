
-- =============================================================================
-- 14) Magazzino: fornitori (listino JSON) + DDT in entrata
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.magazzino_fornitori (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'grossista',
  note TEXT DEFAULT '',
  listino JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magazzino_fornitori_tenant ON public.magazzino_fornitori(tenant_id, nome);

CREATE TABLE IF NOT EXISTS public.magazzino_ddt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  data_doc DATE NOT NULL,
  fornitore TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magazzino_ddt_tenant ON public.magazzino_ddt(tenant_id, data_doc DESC);

ALTER TABLE public.magazzino_fornitori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magazzino_ddt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magazzino_fornitori_staff_all" ON public.magazzino_fornitori;
CREATE POLICY "magazzino_fornitori_staff_all" ON public.magazzino_fornitori
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "magazzino_ddt_staff_all" ON public.magazzino_ddt;
CREATE POLICY "magazzino_ddt_staff_all" ON public.magazzino_ddt
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazzino_fornitori TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazzino_ddt TO authenticated;

COMMENT ON TABLE public.magazzino_fornitori IS 'Fornitori magazzino con listino righe in JSON (descrizione, prezzo, unità).';
COMMENT ON TABLE public.magazzino_ddt IS 'DDT in entrata; riferimento per contabilità fatture.';
