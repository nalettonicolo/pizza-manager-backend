-- Incrementale post-baseline (unica migration consolidata). Delta manuale corrente: sql/sql_upgrade.sql
-- =============================================================================
-- PizzaManager — Tutte le migration incrementali unificate (post remote_schema)
-- Copia speculare: supabase/migrations/20260406100000_post_remote_schema_unified.sql
-- Fonte unica per: SQL Editor manuale + supabase db push (dopo il baseline).
--
-- Ordine:
--   1) pizzamanager_unified_incremental (schema/viste/RLS base)
--   2) staff_password_note (tenant admin)
--   3) clienti auth trigger + colonne
--   4) superadmin ruoli_pizzeria + RLS staff_password
--   5) PM_LATEST: subscriptions ciclo, colonne ordini/righe, RPC create_order_with_items
--   6) Fidelity Card + parametri consegna/domicilio
--
-- Prerequisito: eseguire prima supabase/migrations/20260220171734_remote_schema.sql
--   (o DB già allineato a quello snapshot).
--
-- I marcatori -- >>> BEGIN / <<< END indicano la provenienza storica dei blocchi
-- (file migration originali rimossi; non rieseguire quei path come file separati).
-- =============================================================================

-- >>> BEGIN: supabase/migrations/20260402100000_pizzamanager_unified_incremental.sql
-- =============================================================================
-- PizzaManager — SQL UNIFICATO incrementale (idempotente)
-- Generato: consolidamento migrazioni 202502–202603 (storico); nuovi delta: sql/sql_upgrade.sql
--
-- Ordine: dopo il dump Supabase (supabase/migrations/20260220171734_remote_schema.sql)
--         oppure su DB già allineato. Sicuro da rieseguire (IF NOT EXISTS / blocchi DO).
--
-- Non include il dump remoto completo: resta il file separato remote_schema.
-- =============================================================================
-- ============================================
-- PIZZAMANAGER – RLS e indici enterprise
-- Eseguire su Supabase (schema public o core)
-- ============================================

-- Indici consigliati (adatta i nomi schema/tabella se usi "core")
-- Assumendo tabelle in schema public; se usi core.tenants ecc. sostituisci.

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_attivo ON tenants(attivo);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stato ON subscriptions(stato);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entita_entita_id ON audit_logs(entita, entita_id);

-- Ordini (performance)
CREATE INDEX IF NOT EXISTS idx_ordini_tenant_id ON ordini(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordini_stato ON ordini(stato);
CREATE INDEX IF NOT EXISTS idx_ordini_created_at ON ordini(created_at);

-- Prodotti / Ingredienti
CREATE INDEX IF NOT EXISTS idx_prodotti_tenant_id ON prodotti(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredienti_tenant_id ON ingredienti(tenant_id);

-- ============================================
-- RLS (Row Level Security) – esempio
-- Sblocca RLS sulle tabelle e crea policy per tenant
-- ============================================

-- Abilita RLS (esempio su ordini)
-- ALTER TABLE ordini ENABLE ROW LEVEL SECURITY;

-- Policy: utenti vedono solo i dati del proprio tenant
-- (Supabase usa auth.uid(); il tuo backend inietta tenant_id dal JWT)
-- CREATE POLICY "Isolate by tenant" ON ordini
--   FOR ALL
--   USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Nota: con backend Node/Nest che fa le query, spesso RLS non è usato e l’isolamento
-- è garantito dal middleware che inietta sempre tenantId nelle query.
-- Se usi Supabase Client dal frontend, abilita RLS e imposta app.current_tenant_id.


-- ============================================================
-- PIZZAMANAGER – FULL DATABASE ENTERPRISE
-- Multi-tenant SaaS – Schema: core
-- Idempotente – Sicuro da rieseguire
-- ============================================================

-- ============================================================
-- SCHEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS core;
SET search_path TO core;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE core.ruolo AS ENUM ('OWNER','ADMIN','OPERATORE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE core.piano_saas AS ENUM ('FREE','PRO','ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE core.stato_ordine AS ENUM ('IN_ATTESA','IN_PREPARAZIONE','PRONTO','CONSEGNATO','ANNULLATO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE core.stato_subscription AS ENUM ('ATTIVA','SCADUTA','SOSPESA','CANCELLATA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- TENANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    piano core.piano_saas DEFAULT 'FREE',
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    ruolo core.ruolo NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    attivo BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    piano core.piano_saas DEFAULT 'FREE',
    stato core.stato_subscription DEFAULT 'ATTIVA',
    rinnovo_il TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    azione TEXT NOT NULL,
    entita TEXT NOT NULL,
    entita_id TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- CONFIGURAZIONE COSTI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.configurazione_costi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    costo_impasto NUMERIC NOT NULL,
    costo_energia NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- INGREDIENTI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.ingredienti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    costo NUMERIC NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- PRODOTTI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.prodotti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    prezzo NUMERIC NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    attivo BOOLEAN DEFAULT true,
    costo_calcolato NUMERIC,
    margine NUMERIC,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- PRODOTTO ↔ INGREDIENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS core.prodotto_ingrediente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE CASCADE,
    ingrediente_id UUID NOT NULL REFERENCES core.ingredienti(id) ON DELETE CASCADE,
    quantita NUMERIC NOT NULL,
    UNIQUE (prodotto_id, ingrediente_id)
);

-- ============================================================
-- ORDINI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.ordini (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INTEGER NOT NULL,
    stato core.stato_ordine DEFAULT 'IN_ATTESA',
    totale NUMERIC NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP,
    UNIQUE (tenant_id, numero)
);

-- ============================================================
-- RIGHE ORDINE
-- ============================================================

CREATE TABLE IF NOT EXISTS core.riga_ordine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE RESTRICT,
    quantita INTEGER NOT NULL,
    prezzo NUMERIC NOT NULL
);

-- ============================================================
-- AGGIUNGI deleted_at SE MANCA (DB già esistenti / vecchie run)
-- Così gli indici parziali WHERE deleted_at IS NULL funzionano.
-- ============================================================

ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.configurazione_costi ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================
-- INDICI ENTERPRISE OTTIMIZZATI
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON core.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON core.users(tenant_id, attivo) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ordini_tenant_stato ON core.ordini(tenant_id, stato);
CREATE INDEX IF NOT EXISTS idx_ordini_tenant_created ON core.ordini(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_prodotti_tenant_attivo ON core.prodotti(tenant_id, attivo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ingredienti_tenant ON core.ingredienti(tenant_id);

CREATE INDEX IF NOT EXISTS idx_riga_ordine_tenant ON core.riga_ordine(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON core.audit_logs(tenant_id, created_at);

-- ============================================================
-- RLS – ISOLAMENTO MULTI-TENANT
-- ============================================================

ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.prodotti ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ingredienti ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ordini ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.riga_ordine ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy generica multi-tenant (esempio su ordini)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'ordini' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.ordini
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'users' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.users
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Prodotti
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'prodotti' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.prodotti
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Ingredienti
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'ingredienti' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.ingredienti
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Riga ordine
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'riga_ordine' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.riga_ordine
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'audit_logs' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.audit_logs
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- ============================================================
-- FINE DATABASE
-- ============================================================


-- ============================================================
-- Tabelle per auth frontend: utenti_ruoli (staff) e clienti
-- Collegano auth.users (Supabase Auth) a core.tenants
-- ============================================================

-- Staff: ruoli operativi (superadmin, admin, cassa, bancone, cucina, pizzaiolo, delivery)
CREATE TABLE IF NOT EXISTS public.utenti_ruoli (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ruolo TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clienti: profilo cliente collegato a auth.users
CREATE TABLE IF NOT EXISTS public.clienti (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_utenti_ruoli_tenant ON public.utenti_ruoli(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clienti_tenant ON public.clienti(tenant_id);

-- RLS: utenti possono leggere solo il proprio profilo
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utenti_ruoli_select_own" ON public.utenti_ruoli;
CREATE POLICY "utenti_ruoli_select_own"
    ON public.utenti_ruoli FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clienti_select_own" ON public.clienti;
CREATE POLICY "clienti_select_own"
    ON public.clienti FOR SELECT
    USING (auth.uid() = id);

-- GRANT: ruolo authenticated deve poter fare SELECT (RLS filtra le righe)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.utenti_ruoli TO authenticated;
GRANT SELECT ON public.clienti TO authenticated;


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


-- Dopo DROP/CREATE di public.tenants le migrazioni 20260322140000 / 20260322180000
-- concedevano solo a service_role → PostgREST (anon/authenticated) riceve
-- "permission denied for view tenants".
-- Con vista SECURITY INVOKER servono privilegi su public.tenants e sulla base admin.tenants,
-- più USAGE sullo schema admin.

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    -- Lettura pubblica limitata in app (es. getPublicTenantInfo): in progetti multi-tenant
    -- valutare RLS su admin.tenants o una vista/rpc dedicata.
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;


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


-- La vista public.tenants con CASE su `piano` (→ core.piano_saas) NON è aggiornabile automaticamente:
-- UPDATE da app/PostgREST su colonne operative (logo_url, orari, ecc.) falliscono.
-- Vista semplice su admin.tenants (solo riferimenti a colonne) → UPDATE/INSERT consentiti al ruolo con GRANT.

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta vista updatable.';
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

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


-- Dominio pubblico cliente + funzioni per vetrina su hostname dedicato (Firebase + DNS).

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta public_domain.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS public_domain text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS public_domain_status text DEFAULT 'none';
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS public_domain_requested_at timestamptz;

  COMMENT ON COLUMN admin.tenants.public_domain IS 'Hostname pubblico (es. menu.esempio.it) senza schema; match con window.location.hostname';
  COMMENT ON COLUMN admin.tenants.public_domain_status IS 'none | requested | dns_pending | live (workflow in app)';
  COMMENT ON COLUMN admin.tenants.public_domain_requested_at IS 'Ultima richiesta pubblicazione dominio da admin';

  DROP INDEX IF EXISTS admin_tenants_public_domain_lower_key;
  CREATE UNIQUE INDEX admin_tenants_public_domain_lower_key
    ON admin.tenants (lower(btrim(public_domain)))
    WHERE public_domain IS NOT NULL AND btrim(public_domain) <> '';
END $$;

-- Ricrea vista (SELECT * espone le nuove colonne)
DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

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

-- Risolve tenant pubblico in base all'hostname (nessun JWT richiesto)
CREATE OR REPLACE FUNCTION public.resolve_public_tenant_by_domain(p_host text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, admin
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      id,
      nome,
      logo_url,
      indirizzo,
      email,
      telefono,
      orari_settimana,
      parametri_operativi
    FROM admin.tenants
    WHERE deleted_at IS NULL
      AND (attivo IS NULL OR attivo = true)
      AND (
        (
          public_domain IS NOT NULL
          AND btrim(public_domain) <> ''
          AND lower(btrim(public_domain)) = lower(btrim(p_host))
        )
        OR (
          lower(btrim(p_host)) LIKE '%.pizzamanager.it'
          AND lower(btrim(slug)) = lower(split_part(btrim(p_host), '.', 1))
        )
      )
    LIMIT 1
  ) t;
$$;

COMMENT ON FUNCTION public.resolve_public_tenant_by_domain(text) IS 'Menu pubblico: risolve tenant da hostname (dominio cliente collegato in admin.tenants.public_domain).';

GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_by_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_by_domain(text) TO authenticated;

-- Menu filtrato per tenant risolto dal dominio (stesso schema della vista prodotti_menu_pubblico)
CREATE OR REPLACE FUNCTION public.get_public_menu_for_domain(p_host text)
RETURNS SETOF public.prodotti_menu_pubblico
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, admin, core
AS $$
  SELECT v.*
  FROM public.prodotti_menu_pubblico v
  WHERE v.tenant_id = (
    SELECT t.id
    FROM admin.tenants t
    WHERE t.deleted_at IS NULL
      AND (t.attivo IS NULL OR t.attivo = true)
      AND (
        (
          t.public_domain IS NOT NULL
          AND btrim(t.public_domain) <> ''
          AND lower(btrim(t.public_domain)) = lower(btrim(p_host))
        )
        OR (
          lower(btrim(p_host)) LIKE '%.pizzamanager.it'
          AND lower(btrim(t.slug)) = lower(split_part(btrim(p_host), '.', 1))
        )
      )
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.get_public_menu_for_domain(text) IS 'Menu pubblico filtrato per tenant associato a public_domain (hostname).';

GRANT EXECUTE ON FUNCTION public.get_public_menu_for_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_menu_for_domain(text) TO authenticated;


-- URL del sito vetrina del cliente (es. Google Sites, sito istituzionale) — separato dal dominio PizzaManager.

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta sito_web_cliente.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sito_web_cliente text;
  COMMENT ON COLUMN admin.tenants.sito_web_cliente IS 'URL completo del sito web del cliente (marketing, Google Sites, ecc.); non è usato per la risoluzione tenant';
END $$;

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

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


-- =============================================================================
-- PizzaManager — SQL incrementale unificato (idempotente)
--
-- PM-SQL-REF: UNIFIED-INCR-v1-2026-03-22
-- PM-SQL-FP:   E7A4C91B2D804E6F9A1C5E8B3F0D2A74
--
-- Uso: database già inizializzato (es. dopo schema bootstrap). Esegui in
-- Supabase → SQL Editor. Non sostituisce sql/schema_completo_pizzamanager.sql.
--
-- Contiene: visibile_online, viste public, colonne accesso aree, GRANT anon,
--           pattern RLS/policy idempotenti dove applicabile.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) core.prodotti — visibilità menu online
-- -----------------------------------------------------------------------------
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS visibile_online BOOLEAN DEFAULT true;


-- -----------------------------------------------------------------------------
-- 2) Vista public."Prodotto" (client app / autenticati)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public."Prodotto" CASCADE;
CREATE VIEW public."Prodotto" AS
  SELECT
    id,
    nome,
    descrizione,
    prezzo,
    attivo,
    ordine,
    immagine_url,
    visibile_online,
    tenant_id,
    categoria_id,
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.prodotti
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;


-- -----------------------------------------------------------------------------
-- 3) Vista prodotti_menu_pubblico (anon + nome categoria)
-- -----------------------------------------------------------------------------
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
  LEFT JOIN core.categorie cat ON cat.id = p.categoria_id
  WHERE p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL);

GRANT SELECT ON public.prodotti_menu_pubblico TO anon;


-- -----------------------------------------------------------------------------
-- 4) public.utenti_ruoli — permessi aree operative (Admin → Ruoli)
-- -----------------------------------------------------------------------------
ALTER TABLE public.utenti_ruoli
  ADD COLUMN IF NOT EXISTS accesso_riepilogo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_cassa BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_cucina BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_bancone BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_pizzaiolo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_delivery BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_pony BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.utenti_ruoli.accesso_riepilogo IS 'Area operativa Riepilogo';
COMMENT ON COLUMN public.utenti_ruoli.accesso_cassa IS 'Area Cassa';
COMMENT ON COLUMN public.utenti_ruoli.accesso_cucina IS 'Area Cucina';
COMMENT ON COLUMN public.utenti_ruoli.accesso_bancone IS 'Area Bancone';
COMMENT ON COLUMN public.utenti_ruoli.accesso_pizzaiolo IS 'Area Pizzaioli';
COMMENT ON COLUMN public.utenti_ruoli.accesso_delivery IS 'Area Delivery';
COMMENT ON COLUMN public.utenti_ruoli.accesso_pony IS 'Area Pony (stesso reparto Delivery)';


-- -----------------------------------------------------------------------------
-- 5) Vista ruoli_pizzeria
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;
GRANT UPDATE ON public.utenti_ruoli TO authenticated;


-- -----------------------------------------------------------------------------
-- 6) GRANT schema public / letture anon (menu pubblico, tenant)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public."Prodotto" TO anon;
GRANT SELECT ON public.punti_vendita TO anon;
GRANT SELECT ON public.prodotti_menu_pubblico TO anon;


-- -----------------------------------------------------------------------------
-- 7) RLS — attivazione idempotente (senza sovrascrivere policy esistenti)
-- -----------------------------------------------------------------------------
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

-- Pattern per nuove policy (idempotente): sempre DROP POLICY IF EXISTS + CREATE POLICY.
-- Esempio:
--   DROP POLICY IF EXISTS "nome_policy" ON public.utenti_ruoli;
--   CREATE POLICY "nome_policy" ON public.utenti_ruoli FOR ... TO authenticated USING (...);
--
-- Le policy complete (anche con public.tenant_admins) sono in
-- sql/schema_completo_pizzamanager.sql — non duplicarle qui se il DB è già allineato.


-- -----------------------------------------------------------------------------
-- 8) OPZIONALE — superadmin in utenti_ruoli (sostituisci UUID e tenant)
-- -----------------------------------------------------------------------------
-- INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id, attivo)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'superadmin',
--   (SELECT id FROM core.tenants ORDER BY created_at NULLS LAST LIMIT 1),
--   true
-- )
-- ON CONFLICT (user_id) DO UPDATE SET
--   ruolo = EXCLUDED.ruolo,
--   tenant_id = EXCLUDED.tenant_id,
--   attivo = true;

-- =============================================================================
-- Fine PM-SQL-REF: UNIFIED-INCR-v1-2026-03-22
-- =============================================================================

-- <<< END: supabase/migrations/20260402100000_pizzamanager_unified_incremental.sql

-- >>> BEGIN: supabase/migrations/20260403130000_staff_password_note_tenant_admin.sql
-- Nota password accesso dipendenti: solo tenant admin (tenant_admins), non leggibile dagli altri utenti.
-- Non è la password reale in auth.users: è un archivio opzionale che il titolare aggiorna quando crea/resetta l’accesso.

CREATE TABLE IF NOT EXISTS public.staff_password_note (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants (id) ON DELETE CASCADE,
  password_nota TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_password_note_tenant ON public.staff_password_note (tenant_id);

ALTER TABLE public.staff_password_note ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_password_note TO authenticated;

COMMENT ON TABLE public.staff_password_note IS 'Nota password accesso staff (solo admin tenant). Non sincronizzata con GoTrue; RLS: solo tenant_admins.';

-- <<< END: supabase/migrations/20260403130000_staff_password_note_tenant_admin.sql

-- >>> BEGIN: supabase/migrations/20260403150000_clienti_auth_trigger_and_columns.sql
-- Colonne profilo su public.clienti + trigger dopo INSERT su auth.users
-- (registrazione cliente da sito pizzeria con user_metadata.tenant_id).

ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS indirizzo TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_meta JSONB;
  v_nome TEXT;
  v_indirizzo TEXT;
  v_telefono TEXT;
  v_email TEXT;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_nome := NULLIF(trim(COALESCE(v_meta->>'nome', v_meta->>'full_name', '')), '');
  v_indirizzo := NULLIF(trim(COALESCE(v_meta->>'indirizzo', '')), '');
  v_telefono := NULLIF(trim(COALESCE(v_meta->>'telefono', v_meta->>'phone', '')), '');
  v_email := NULLIF(trim(COALESCE(NEW.email, '')), '');

  BEGIN
    v_tenant_id := (v_meta->>'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;

  IF v_tenant_id IS NULL AND to_regclass('public.anagrafica_clienti') IS NOT NULL AND v_nome IS NOT NULL THEN
    SELECT ac.tenant_id INTO v_tenant_id
    FROM public.anagrafica_clienti ac
    WHERE trim(lower(ac.nome)) = trim(lower(v_nome))
      AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(COALESCE(v_indirizzo, '')))
      AND trim(COALESCE(ac.telefono, '')) = trim(COALESCE(v_telefono, ''))
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.clienti (id, tenant_id, nome, indirizzo, telefono, email)
    VALUES (NEW.id, v_tenant_id, v_nome, v_indirizzo, v_telefono, v_email)
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      nome = COALESCE(EXCLUDED.nome, clienti.nome),
      indirizzo = COALESCE(EXCLUDED.indirizzo, clienti.indirizzo),
      telefono = COALESCE(EXCLUDED.telefono, clienti.telefono),
      email = COALESCE(EXCLUDED.email, clienti.email);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Crea/aggiorna public.clienti da raw_user_meta_data (tenant_id, nome, …) o match anagrafica_clienti se esiste.';

-- <<< END: supabase/migrations/20260403150000_clienti_auth_trigger_and_columns.sql

-- >>> BEGIN: supabase/migrations/20260404120000_staff_password_superadmin_ruoli_pizzeria.sql
-- Super Admin: lettura ruoli di qualsiasi tenant (vista ruoli_pizzeria) e gestione staff_password_note.
-- Il Super Admin è identificato da public.utenti_ruoli (ruolo = 'superadmin', attivo).

-- -----------------------------------------------------------------------------
-- 1) Vista ruoli_pizzeria: include tutte le righe se l'utente corrente è superadmin
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
)
OR EXISTS (
  SELECT 1
  FROM public.utenti_ruoli ur_sa
  WHERE ur_sa.user_id = auth.uid()
    AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
    AND lower(trim(ur_sa.ruolo)) = 'superadmin'
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) staff_password_note: tenant_admins oppure superadmin (qualsiasi tenant)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  );

COMMENT ON TABLE public.staff_password_note IS 'Nota password accesso staff (archivio titolare). RLS: tenant_admins del tenant o utente con ruolo superadmin in utenti_ruoli.';

-- <<< END: supabase/migrations/20260404120000_staff_password_superadmin_ruoli_pizzeria.sql

-- >>> BEGIN: sql/PM_LATEST_IMPLEMENTATIONS.sql
-- =============================================================================
-- PizzaManager — Ultime implementazioni SQL (consolidato)
-- Data riferimento: 2026-04
--
-- Contenuto (idempotente dove possibile):
--   1) public.staff_password_note — archivio note password staff (Admin Ruoli)
--   2) RLS staff_password_note — tenant_admins OPPURE superadmin (utenti_ruoli)
--   3) Vista public.ruoli_pizzeria — superadmin vede tutti i tenant
--   4) subscriptions — ciclo_fatturazione_giorni + sconto_annuale_percent (public e/o core)
--   5) core.ordini — colonne cassa / ordine cliente (note, pagamento, tipo, ritiro…)
--   6) core.riga_ordine — formato_nome, ingredienti_cottura_summary (comanda / cassa)
--   7) public.create_order_with_items — RPC allineata a adminService (Supabase JS)
--
-- App (senza DDL qui): Admin Magazzino/Contabilità usa ancora localStorage per tenant;
--   parametri_operativi (JSON su tenants) — comanda / cassa (CassaImpostazioniPage + printComanda.js):
--   comanda_copie, comanda_font_size (px 8–28), comanda_titolo_scale, comanda_qty_scale,
--   comanda_dettaglio_scale, comanda_line_height, comanda_margin_mm, comanda_width_mm,
--   comanda_font_family (system|sans|mono|serif), comanda_mostra_id_ordine, comanda_mostra_pagamento,
--   comanda_mostra_dest_stampanti, comanda_stampanti[], comanda_stampa_auto;
--   più ritiro_ogni_min, pizze_ogni_15_min, consegne_ogni_min, …
--
-- Prerequisiti tipici: public.utenti_ruoli, public.tenant_admins, auth.users,
--   core.tenants (FK su staff_password_note). Esegui su Supabase (SQL Editor) o CLI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1–2) Tabella + RLS staff_password_note (admin tenant + superadmin piattaforma)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_password_note (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants (id) ON DELETE CASCADE,
  password_nota TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_password_note_tenant ON public.staff_password_note (tenant_id);

ALTER TABLE public.staff_password_note ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_password_note TO authenticated;

COMMENT ON TABLE public.staff_password_note IS
  'Nota password accesso staff (archivio titolare). RLS: tenant_admins del tenant o superadmin (utenti_ruoli). Non è la password Auth.';

-- -----------------------------------------------------------------------------
-- 3) Vista ruoli_pizzeria: superadmin vede tutti gli staff; altri solo il proprio tenant
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
)
OR EXISTS (
  SELECT 1
  FROM public.utenti_ruoli ur_sa
  WHERE ur_sa.user_id = auth.uid()
    AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
    AND lower(trim(ur_sa.ruolo)) = 'superadmin'
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) Abbonamenti: ciclo (codice 30/365 = mesi di calendario in app) + sconto annuale %
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN public.subscriptions.ciclo_fatturazione_giorni IS
      'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN public.subscriptions.sconto_annuale_percent IS
      'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;

  IF to_regclass('core.subscriptions') IS NOT NULL THEN
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN core.subscriptions.ciclo_fatturazione_giorni IS
      'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN core.subscriptions.sconto_annuale_percent IS
      'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5–6) Ordini e righe: campi usati da Cassa (createOrder) e stampa comanda
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NOT NULL THEN
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_ordine TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS orario_ritiro TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS indirizzo_consegna TEXT;
    COMMENT ON COLUMN core.ordini.tipo_ordine IS 'es. negozio | delivery (cassa / clienti).';
    COMMENT ON COLUMN core.ordini.orario_ritiro IS 'Fascia oraria ritiro/consegna scelta in cassa.';
  END IF;

  IF to_regclass('core.riga_ordine') IS NOT NULL THEN
    ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS formato_nome TEXT;
    ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS ingredienti_cottura_summary TEXT;
    COMMENT ON COLUMN core.riga_ordine.ingredienti_cottura_summary IS 'Testo riepilogo modifiche ingredienti/cottura per cucina e comanda.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7) RPC create_order_with_items (firma allineata a src/features/admin/services/adminService.js)
--     Rimuove overload public/core preesistenti con lo stesso nome, poi crea public.
-- -----------------------------------------------------------------------------
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), '')
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Crea ordine + righe (cassa). p_items: prodotto_id, quantita, prezzo, formato_nome, ingredienti_cottura_summary.';

-- <<< END: sql/PM_LATEST_IMPLEMENTATIONS.sql

-- >>> BEGIN: sql/PM_FIDELITY_IMPLEMENTATIONS_UNIFIED.sql
-- =============================================================================
-- PizzaManager — Fidelity Card + canale domicilio
--
-- Contenuto:
--   1) Tabelle public.fidelity_saldi, public.fidelity_movimenti + RLS + GRANT
--   2) Colonna fidelity_saldi.nome_negozio (alias bancone)
--   3) Default opzionali in core.tenants.parametri_operativi:
--        consegna_domicilio_attiva, fidelity_abilita_clienti_domicilio
--
-- Altre chiavi fidelity (solo JSON, nessuna colonna DB): fidelity_nome_programma,
-- fidelity_punti_per_euro, fidelity_attivo, fidelity_timbri_per_pizza,
-- fidelity_timbri_scheda_totale, fidelity_premi, fidelity_card_* (tema tessera).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabelle fidelity
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2) Alias nome in negozio (bancone)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fidelity_saldi
  ADD COLUMN IF NOT EXISTS nome_negozio TEXT;

COMMENT ON COLUMN public.fidelity_saldi.nome_negozio IS
  'Nome come lo chiami in negozio (bancone); opzionale, affiancato al codice carta.';

-- -----------------------------------------------------------------------------
-- 3) Parametri tenant: consegna + fidelity domicilio (default espliciti nel JSON)
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- Fine. Dopo l'esecuzione: Dashboard Supabase → Settings → API → Reload schema
--   se PostgREST non espone subito tabelle/colonne nuove.
-- =============================================================================

-- <<< END: sql/PM_FIDELITY_IMPLEMENTATIONS_UNIFIED.sql
