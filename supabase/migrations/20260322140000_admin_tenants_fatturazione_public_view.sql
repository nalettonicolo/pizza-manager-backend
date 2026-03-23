-- Super Admin usa `public.tenants`, che nel dump remoto è una VISTA su `admin.tenants`.
-- La migrazione 20260322120000 aggiungeva le colonne solo su `core.tenants`: PostgREST
-- non le vedeva su `public.tenants` → errore schema cache (es. addebito_automatico_mensile).

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta sincronizzazione fatturazione / vista public.tenants.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS slug text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS partita_iva text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS email_fatturazione text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS pec text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS codice_univoco_sdi text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS addebito_automatico_mensile boolean DEFAULT false;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS data_attivazione_abbonamento date;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sconto_percentuale numeric(5, 2) DEFAULT 0;

  UPDATE admin.tenants t
  SET slug = 'tenant-' || replace(t.id::text, '-', '')
  WHERE t.slug IS NULL OR btrim(t.slug) = '';

  -- Stesso slug su più righe: suffisso deterministico da id (senza alterare la prima riga del gruppo).
  UPDATE admin.tenants t
  SET slug = t.slug || '-' || substr(replace(t.id::text, '-', ''), 1, 8)
  WHERE t.id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS rn
      FROM admin.tenants
    ) x WHERE rn > 1
  );

  ALTER TABLE admin.tenants ALTER COLUMN slug SET NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS admin_tenants_slug_key ON admin.tenants (slug);

  COMMENT ON COLUMN admin.tenants.partita_iva IS 'Partita IVA esercente';
  COMMENT ON COLUMN admin.tenants.email_fatturazione IS 'Email aziendale / fatturazione';
  COMMENT ON COLUMN admin.tenants.pec IS 'PEC';
  COMMENT ON COLUMN admin.tenants.codice_univoco_sdi IS 'Codice destinatario / SDI (fatturazione elettronica)';
  COMMENT ON COLUMN admin.tenants.addebito_automatico_mensile IS 'Se true: addebito online automatico a cadenza mensile';
  COMMENT ON COLUMN admin.tenants.data_attivazione_abbonamento IS 'Data di riferimento per il ciclo di addebito mensile';
  COMMENT ON COLUMN admin.tenants.sconto_percentuale IS 'Sconto concordato sul canone (0–100)';

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  -- CREATE OR REPLACE VIEW non può riallineare colonne se la vista esistente ha ordine/nomi diversi
  -- (es. slug già in posizione 3 in produzione vs dump con solo piano) → 42P16.
  -- Ricreazione completa: DROP + CREATE. CASCADE solo se dipendenze da altre viste (raro su tenants).
  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella (relkind=r): non ricreare vista; verifica PostgREST.';
  ELSIF relkind = 'v' OR relkind IS NULL THEN
    DROP VIEW IF EXISTS public.tenants CASCADE;

    IF to_regtype('core.piano_saas') IS NOT NULL THEN
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        (
          CASE upper(trim(coalesce(piano::text, '')))
            WHEN 'PRO' THEN 'PRO'::core.piano_saas
            WHEN 'ENTERPRISE' THEN 'ENTERPRISE'::core.piano_saas
            WHEN 'TRIAL' THEN 'FREE'::core.piano_saas
            ELSE 'FREE'::core.piano_saas
          END
        ) AS piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale
      FROM admin.tenants;
    ELSE
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale
      FROM admin.tenants;
    END IF;

    ALTER VIEW public.tenants OWNER TO postgres;
    GRANT ALL ON TABLE public.tenants TO service_role;
  ELSE
    RAISE NOTICE 'public.tenants relkind=%: salta vista; aggiorna manualmente se necessario.', relkind;
  END IF;
END $$;
