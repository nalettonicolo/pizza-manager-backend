-- Data di fine periodo di prova (superadmin: gestione clienti TRIAL).

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta prova_valida_fino.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS prova_valida_fino date;
  COMMENT ON COLUMN admin.tenants.prova_valida_fino IS 'Ultimo giorno incluso del periodo di prova; null = non impostato';

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
        orari_settimana,
        prova_valida_fino
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
        orari_settimana,
        prova_valida_fino
      FROM admin.tenants;
    END IF;

    ALTER VIEW public.tenants OWNER TO postgres;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;

-- Ripristina privilegi PostgREST (DROP VIEW rimuove la vista precedente).
DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;
