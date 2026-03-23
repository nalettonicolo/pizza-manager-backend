-- Colonne usate da Admin (Dati pizzeria, tema menu) e da TenantContext: la vista public.tenants deve esporle.

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta colonne operative.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS logo_url text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS email text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS telefono text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS indirizzo text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS lat double precision;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS lng double precision;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS parametri_operativi jsonb;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS orari_settimana jsonb;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  IF relkind = 'v' OR relkind IS NULL THEN
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
        sconto_percentuale,
        logo_url,
        email,
        telefono,
        indirizzo,
        lat,
        lng,
        parametri_operativi,
        orari_settimana
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
        sconto_percentuale,
        logo_url,
        email,
        telefono,
        indirizzo,
        lat,
        lng,
        parametri_operativi,
        orari_settimana
      FROM admin.tenants;
    END IF;

    ALTER VIEW public.tenants OWNER TO postgres;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;
