-- =============================================================================
-- PizzaManager — SQL UPGRADE (nuove implementazioni incrementali)
-- =============================================================================
--
-- Stato:
-- - Le patch della Fase 0 (2026-04-18) sono consolidate in:
--   sql/schema_completo_pizzamanager.sql (coda: CONSOLIDAMENTO FASE 0)
-- - Questo file deve contenere SOLO nuove modifiche non ancora consolidate.
--
-- Regole operative:
-- 1) Aggiungere qui solo patch incrementali idempotenti.
-- 2) Dopo applicazione e verifica su Supabase/staging, consolidare in schema_completo.
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

-- 2026-04-17 - HR dipendenti: foto, allegati strutturati, buste paga
ALTER TABLE public.staff_archivio_dipendenti
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS allegati_hr JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS buste_paga JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.staff_archivio_dipendenti.foto_url IS 'URL o path storage foto profilo dipendente (bucket staff-hr).';
COMMENT ON COLUMN public.staff_archivio_dipendenti.allegati_hr IS 'Metadati allegati HR (JSON array: id, nome, storage_path, creato_at).';
COMMENT ON COLUMN public.staff_archivio_dipendenti.buste_paga IS 'Metadati buste paga (JSON array: id, nome, mese_riferimento, storage_path, creato_at).';

