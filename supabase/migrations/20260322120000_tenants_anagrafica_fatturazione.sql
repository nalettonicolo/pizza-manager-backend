-- Dati fiscali, pagamento mensile automatico e sconto su core.tenants (idempotente)

DO $$
BEGIN
  IF to_regclass('core.tenants') IS NULL THEN
    RAISE NOTICE 'core.tenants non presente: salta estensione colonne (ambiente diverso).';
    RETURN;
  END IF;

  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS partita_iva text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS email_fatturazione text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS pec text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS codice_univoco_sdi text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS addebito_automatico_mensile boolean DEFAULT false;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS data_attivazione_abbonamento date;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS sconto_percentuale numeric(5, 2) DEFAULT 0;

  COMMENT ON COLUMN core.tenants.partita_iva IS 'Partita IVA esercente';
  COMMENT ON COLUMN core.tenants.email_fatturazione IS 'Email aziendale / fatturazione';
  COMMENT ON COLUMN core.tenants.pec IS 'PEC';
  COMMENT ON COLUMN core.tenants.codice_univoco_sdi IS 'Codice destinatario / SDI (fatturazione elettronica)';
  COMMENT ON COLUMN core.tenants.addebito_automatico_mensile IS 'Se true: addebito online automatico a cadenza mensile (es. primo del mese da data attivazione)';
  COMMENT ON COLUMN core.tenants.data_attivazione_abbonamento IS 'Data di riferimento per il ciclo di addebito mensile';
  COMMENT ON COLUMN core.tenants.sconto_percentuale IS 'Sconto concordato sul canone (0–100)';
END $$;
