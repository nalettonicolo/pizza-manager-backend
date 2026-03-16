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
