
-- =============================================================================
-- 3) Estensioni core.ordini
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto estensioni ordine.';
    RETURN;
  END IF;

  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS consegna_lng DOUBLE PRECISION;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS consegna_lat DOUBLE PRECISION;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS pagamento_dettaglio JSONB;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS stato_consegna TEXT;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS punto_vendita_id UUID;

  COMMENT ON COLUMN core.ordini.consegna_lng IS 'Longitudine indirizzo consegna (verifica area / tracciamento).';
  COMMENT ON COLUMN core.ordini.consegna_lat IS 'Latitudine indirizzo consegna.';
  COMMENT ON COLUMN core.ordini.pagamento_dettaglio IS 'Pagamento misto: es. [{"tipo":"Contanti","importo":10},{"tipo":"Carta","importo":5}].';
  COMMENT ON COLUMN core.ordini.stato_consegna IS 'Delivery: es. RICHIESTA, IN_PREPARAZIONE, IN_VIAGGIO, CONSEGNATO.';
  COMMENT ON COLUMN core.ordini.punto_vendita_id IS 'Punto vendita (core.punti_vendita) se multi-PV.';

  IF to_regclass('core.punti_vendita') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'ordini_punto_vendita_id_fkey'
    ) THEN
      ALTER TABLE core.ordini
        ADD CONSTRAINT ordini_punto_vendita_id_fkey
        FOREIGN KEY (punto_vendita_id) REFERENCES core.punti_vendita(id) ON DELETE SET NULL;
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

