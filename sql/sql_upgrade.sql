-- =============================================================================
-- PizzaManager — SQL UPGRADE (nuove implementazioni incrementali)
-- =============================================================================
--
-- Stato:
-- - Le patch storiche sono state consolidate in:
--   sql/schema_completo_pizzamanager.sql
-- - Questo file deve contenere SOLO nuove modifiche non ancora consolidate.
--
-- Regole operative:
-- 1) Aggiungere qui solo patch incrementali idempotenti.
-- 2) Dopo applicazione e verifica, consolidare in schema_completo.
-- 3) Poi svuotare di nuovo questo file mantenendo il template.
--
-- Template blocco patch:
-- -----------------------------------------------------------------------------
-- -- YYYY-MM-DD - titolo breve
-- DO $$
-- BEGIN
--   -- SQL idempotente
-- END $$;
-- -----------------------------------------------------------------------------
--
-- 2026-04-15 - Fix categorie corrette in vetrina / preview (tenant-safe)
DROP VIEW IF EXISTS public.prodotti_menu_pubblico CASCADE;
CREATE VIEW public.prodotti_menu_pubblico AS
  SELECT
    p.id,
    p.nome,
    p.descrizione,
    p.prezzo,
    p.attivo,
    p.ordine,
    p.immagine_url,
    p.visibile_online,
    p.tenant_id,
    p.categoria_id,
    cat.nome AS categoria_nome,
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt",
    p.deleted_at AS "deletedAt"
  FROM core.prodotti p
  LEFT JOIN core.categorie cat
    ON cat.id = p.categoria_id
   AND cat.tenant_id = p.tenant_id
  WHERE p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL);

GRANT SELECT ON public.prodotti_menu_pubblico TO anon;

-- 2026-04-15 - Archivio dipendenti (anagrafica HR base per tenant)
CREATE TABLE IF NOT EXISTS public.staff_archivio_dipendenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  codice_fiscale TEXT,
  data_nascita DATE,
  luogo_nascita TEXT,
  indirizzo_residenza TEXT,
  telefono_personale TEXT,
  email_personale TEXT,
  mansione TEXT,
  tipo_contratto TEXT,
  data_assunzione DATE,
  iban TEXT,
  corsi_formazione JSONB NOT NULL DEFAULT '[]'::jsonb,
  documenti_lavoro JSONB NOT NULL DEFAULT '[]'::jsonb,
  note_hr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_archivio_dipendenti_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_archivio_dipendenti_tenant
  ON public.staff_archivio_dipendenti(tenant_id);

ALTER TABLE public.staff_archivio_dipendenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_archivio_dipendenti_tenant_all ON public.staff_archivio_dipendenti;
CREATE POLICY staff_archivio_dipendenti_tenant_all ON public.staff_archivio_dipendenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_archivio_dipendenti TO authenticated;

COMMENT ON TABLE public.staff_archivio_dipendenti IS
  'Archivio dipendenti per tenant: dati anagrafici, contrattuali, corsi e note HR.';