-- ============================================================
-- PIZZAMANAGER – SCHEMA UNICO (Supabase)
-- Schema completo e aggiornato: modifiche/integrazioni vanno
-- riflesse qui. Per integrazioni incrementali idempotenti (IF NOT EXISTS)
-- usa schema_integrazioni.sql.
-- Esegui in Supabase → SQL Editor.
-- Per RESET totale (sviluppo): esegui dall'inizio.
-- Per DB esistente: commenta FASE 1 e esegui dal blocco desiderato.
-- ============================================================

-- #############################################################################
-- FASE 1: RESET TOTALE (opzionale – solo in sviluppo)
-- #############################################################################

-- ---------- DROP (ordine per FK) ----------
DROP TABLE IF EXISTS public.ingrediente_allergeni CASCADE;
-- Oggetti che potrebbero essere tabelle o viste: rinomina tabella in _backup o drop vista
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT unnest(ARRAY['prodotto_ingrediente','ProdottoIngrediente','ingredienti','configurazione_costi','ConfigurazioneCosti','Prodotto','cottura','formati','Categoria','categorie','Allergene','allergeni','impasti','punti_vendita','tenants','Tenant','Ingrediente','Ordine','RigaOrdine','riga_ordine']) AS n)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = 'public' AND c.relname = r.n AND c.relkind = 'r') THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.n, r.n || '_backup');
    ELSIF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = 'public' AND c.relname = r.n AND c.relkind = 'v') THEN
      EXECUTE format('DROP VIEW public.%I CASCADE', r.n);
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.utenti_ruoli CASCADE;
DROP TABLE IF EXISTS public.clienti CASCADE;

DROP TABLE IF EXISTS core.riga_ordine CASCADE;
DROP TABLE IF EXISTS core.ordini CASCADE;
DROP TABLE IF EXISTS core.prodotto_allergeni CASCADE;
DROP TABLE IF EXISTS core.prodotto_ingrediente CASCADE;
DROP TABLE IF EXISTS core.prodotti CASCADE;
DROP TABLE IF EXISTS core.ingredienti CASCADE;
DROP TABLE IF EXISTS core.formati CASCADE;
DROP TABLE IF EXISTS core.cottura CASCADE;
DROP TABLE IF EXISTS core.categorie CASCADE;
DROP TABLE IF EXISTS core.allergeni CASCADE;
DROP TABLE IF EXISTS core.impasti CASCADE;
DROP TABLE IF EXISTS core.configurazione_costi CASCADE;
DROP TABLE IF EXISTS core.audit_logs CASCADE;
DROP TABLE IF EXISTS core.subscriptions CASCADE;
DROP TABLE IF EXISTS core.users CASCADE;
DROP TABLE IF EXISTS core.punti_vendita CASCADE;
DROP TABLE IF EXISTS core.tenants CASCADE;

DROP TYPE IF EXISTS core.stato_ordine CASCADE;
DROP TYPE IF EXISTS core.stato_subscription CASCADE;
DROP TYPE IF EXISTS core.piano_saas CASCADE;
DROP TYPE IF EXISTS core.ruolo CASCADE;

DROP SCHEMA IF EXISTS core CASCADE;

-- ---------- RICREAZIONE SCHEMA CORE ----------
CREATE SCHEMA core;

CREATE TYPE core.ruolo AS ENUM ('SUPERADMIN', 'OWNER', 'ADMIN', 'OPERATORE');
CREATE TYPE core.piano_saas AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE core.stato_ordine AS ENUM ('IN_ATTESA', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO', 'ANNULLATO');
CREATE TYPE core.stato_subscription AS ENUM ('ATTIVA', 'SCADUTA', 'SOSPESA', 'CANCELLATA');

CREATE TABLE core.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    piano core.piano_saas DEFAULT 'FREE',
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE core.punti_vendita (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    slug TEXT,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_punti_vendita_tenant ON core.punti_vendita(tenant_id);

CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT DEFAULT '',
    nome TEXT,
    ruolo core.ruolo NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    attivo BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE core.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    piano core.piano_saas DEFAULT 'FREE',
    stato core.stato_subscription DEFAULT 'ATTIVA',
    rinnovo_il TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    azione TEXT NOT NULL,
    entita TEXT NOT NULL,
    entita_id TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE core.configurazione_costi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    costo_impasto NUMERIC NOT NULL,
    costo_energia NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE core.ingredienti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    costo_unitario NUMERIC NOT NULL,
    unita_misura TEXT,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    attivo BOOLEAN DEFAULT true,
    ordine INT NOT NULL DEFAULT 0,
    va_in_cottura BOOLEAN DEFAULT false,
    costo_abbondante NUMERIC(10,2),
    costo_senza NUMERIC(10,2),
    costo_poco NUMERIC(10,2),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE core.prodotti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    prezzo NUMERIC,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    costo_base_produzione NUMERIC NOT NULL DEFAULT 0,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE core.prodotto_ingrediente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE CASCADE,
    ingrediente_id UUID NOT NULL REFERENCES core.ingredienti(id) ON DELETE CASCADE,
    quantita NUMERIC NOT NULL,
    UNIQUE (prodotto_id, ingrediente_id)
);

CREATE TABLE core.ordini (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INTEGER NOT NULL,
    stato core.stato_ordine DEFAULT 'IN_ATTESA',
    totale NUMERIC NOT NULL,
    note TEXT,
    tipo_pagamento TEXT,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (tenant_id, numero)
);

CREATE TABLE core.riga_ordine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE RESTRICT,
    quantita INTEGER NOT NULL,
    prezzo NUMERIC NOT NULL,
    formato_nome TEXT
);

CREATE INDEX idx_tenants_slug ON core.tenants(slug);
CREATE INDEX idx_tenants_attivo ON core.tenants(attivo);
CREATE INDEX idx_users_tenant_id ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_ingredienti_tenant ON core.ingredienti(tenant_id);
CREATE INDEX idx_prodotti_tenant ON core.prodotti(tenant_id);
CREATE INDEX idx_prodotto_ingrediente_tenant ON core.prodotto_ingrediente(tenant_id);
CREATE INDEX idx_ordini_tenant ON core.ordini(tenant_id);
CREATE INDEX idx_riga_ordine_tenant ON core.riga_ordine(tenant_id);

-- ---------- PUBLIC (auth) ----------
CREATE TABLE public.utenti_ruoli (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ruolo TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    puo_modificare_parametri BOOLEAN DEFAULT false,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.clienti (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT,
    indirizzo TEXT,
    telefono TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_utenti_ruoli_tenant ON public.utenti_ruoli(tenant_id);
CREATE INDEX idx_clienti_tenant ON public.clienti(tenant_id);
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utenti_ruoli_select_own" ON public.utenti_ruoli;
CREATE POLICY "utenti_ruoli_select_own" ON public.utenti_ruoli FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "clienti_select_own" ON public.clienti;
CREATE POLICY "clienti_select_own" ON public.clienti FOR SELECT USING (auth.uid() = id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.utenti_ruoli TO authenticated;
GRANT SELECT ON public.clienti TO authenticated;
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT SELECT ON core.punti_vendita TO authenticated;

-- Anagrafica clienti (creata dalla cassa senza account auth)
CREATE TABLE IF NOT EXISTS public.anagrafica_clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  indirizzo TEXT,
  telefono TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anagrafica_clienti_tenant ON public.anagrafica_clienti(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anagrafica_clienti_lookup ON public.anagrafica_clienti(tenant_id, trim(lower(nome)), trim(lower(indirizzo)), trim(telefono));

ALTER TABLE public.anagrafica_clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anagrafica_clienti_staff_select" ON public.anagrafica_clienti;
DROP POLICY IF EXISTS "anagrafica_clienti_staff_insert" ON public.anagrafica_clienti;
CREATE POLICY "anagrafica_clienti_staff_select" ON public.anagrafica_clienti
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );
CREATE POLICY "anagrafica_clienti_staff_insert" ON public.anagrafica_clienti
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.anagrafica_clienti TO authenticated;

-- #############################################################################
-- FASE 2: CATEGORIE, PRODOTTI, ALLERGENI, IMPASTI
-- #############################################################################

CREATE TABLE IF NOT EXISTS core.categorie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL,
    ordine INT NOT NULL DEFAULT 0,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_categorie_tenant ON core.categorie(tenant_id);

ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES core.categorie(id) ON DELETE SET NULL;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS immagine_url TEXT;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS descrizione TEXT;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS ordine INT NOT NULL DEFAULT 0;
-- Consenti creazione prodotti senza costo_base (bibite, dolci, fritti)
ALTER TABLE core.prodotti ALTER COLUMN costo_base_produzione SET DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_prodotti_categoria ON core.prodotti(categoria_id);
CREATE INDEX IF NOT EXISTS idx_prodotti_ordine ON core.prodotti(tenant_id, ordine);

CREATE TABLE IF NOT EXISTS core.allergeni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    icona TEXT NOT NULL,
    ordine INT NOT NULL DEFAULT 0,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allergeni_tenant ON core.allergeni(tenant_id);

CREATE TABLE IF NOT EXISTS core.impasti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    costo_base NUMERIC(10,2) NOT NULL DEFAULT 0,
    ordine INT NOT NULL DEFAULT 0,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impasti_tenant ON core.impasti(tenant_id);

CREATE TABLE IF NOT EXISTS core.prodotto_allergeni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE CASCADE,
    allergene_id UUID NOT NULL REFERENCES core.allergeni(id) ON DELETE CASCADE,
    UNIQUE(prodotto_id, allergene_id)
);
CREATE INDEX IF NOT EXISTS idx_prodotto_allergeni_tenant ON core.prodotto_allergeni(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prodotto_allergeni_prodotto ON core.prodotto_allergeni(prodotto_id);

-- Colonne aggiuntive prodotto_ingrediente
ALTER TABLE core.prodotto_ingrediente ADD COLUMN IF NOT EXISTS ordine INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_prodotto_ingrediente_ordine ON core.prodotto_ingrediente(prodotto_id, ordine);

-- #############################################################################
-- FASE 3: FORMATI E COTTURA
-- #############################################################################

CREATE TABLE IF NOT EXISTS core.formati (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    prezzo NUMERIC(10,2) NOT NULL DEFAULT 0,
    ordine INT NOT NULL DEFAULT 0,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formati_tenant ON core.formati(tenant_id);

CREATE TABLE IF NOT EXISTS core.cottura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INT NOT NULL DEFAULT 0,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cottura_tenant ON core.cottura(tenant_id);

-- #############################################################################
-- FASE 4: TENANT – DATI PIZZERIA, ORARI, PARAMETRI
-- #############################################################################

ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS indirizzo TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS lng NUMERIC;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS orari_settimana JSONB DEFAULT '[]';
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS parametri_operativi JSONB DEFAULT '{}';

-- #############################################################################
-- FASE 5: VISTE PUBLIC E GRANT
-- Se un oggetto public è una tabella (dati esistenti) → rinomina in _backup; se è vista → drop.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT unnest(ARRAY['tenants','Tenant','punti_vendita','categorie','Categoria','allergeni','Allergene','impasti','ingredienti','Ingrediente','Ordine','Prodotto','configurazione_costi','ConfigurazioneCosti','prodotto_ingrediente','ProdottoIngrediente','formati','cottura','RigaOrdine','riga_ordine']) AS n)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = 'public' AND c.relname = r.n AND c.relkind = 'r') THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.n, r.n || '_backup');
    ELSIF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = 'public' AND c.relname = r.n AND c.relkind = 'v') THEN
      EXECUTE format('DROP VIEW public.%I CASCADE', r.n);
    END IF;
  END LOOP;
END $$;

CREATE VIEW public.tenants AS
  SELECT t.id, t.nome, t.slug, t.piano, t.attivo, t.logo_url,
         t.indirizzo, t.telefono, t.email, t.lat, t.lng,
         t.orari_settimana, t.parametri_operativi,
         t.created_at, t.updated_at, t.deleted_at
  FROM core.tenants t
  WHERE t.id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, UPDATE ON public.tenants TO authenticated;

CREATE VIEW public.punti_vendita AS
  SELECT pv.id, pv.tenant_id, pv.nome, pv.slug, pv.attivo, pv.created_at, pv.updated_at
  FROM core.punti_vendita pv
  WHERE pv.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT ON public.punti_vendita TO authenticated;

CREATE VIEW public.categorie AS
  SELECT c.id, c.tenant_id, c.nome, c.slug, c.ordine, c.attivo, c.created_at, c.updated_at
  FROM core.categorie c
  WHERE c.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorie TO authenticated;

CREATE VIEW public."Categoria" AS SELECT * FROM public.categorie;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Categoria" TO authenticated;

CREATE VIEW public.allergeni AS
  SELECT a.id, a.tenant_id, a.nome, a.icona, a.ordine, a.attivo, a.created_at, a.updated_at
  FROM core.allergeni a
  WHERE a.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allergeni TO authenticated;

CREATE VIEW public."Allergene" AS SELECT * FROM public.allergeni;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Allergene" TO authenticated;

CREATE VIEW public.impasti AS
  SELECT i.id, i.tenant_id, i.nome, i.costo_base, i.ordine, i.attivo, i.created_at, i.updated_at
  FROM core.impasti i
  WHERE i.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impasti TO authenticated;

ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS colore TEXT;

CREATE VIEW public.ingredienti AS
  SELECT i.id, i.tenant_id, i.nome, i.costo_unitario, i.unita_misura, i.attivo, i.deleted_at,
         i.ordine, i.va_in_cottura, i.costo_abbondante, i.costo_senza, i.costo_poco,
         i.prep_cucina, i.categoria, i.colore
  FROM core.ingredienti i
  WHERE i.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredienti TO authenticated;

CREATE VIEW public."Ingrediente" AS SELECT * FROM public.ingredienti;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ingrediente" TO authenticated;

-- Trigger per INSERT/UPDATE/DELETE su public.ingredienti (scrivono su core.ingredienti)
CREATE OR REPLACE FUNCTION public.ingredienti_insert()
RETURNS TRIGGER AS $$
DECLARE r core.ingredienti;
BEGIN
  INSERT INTO core.ingredienti (tenant_id, nome, costo_unitario, unita_misura, attivo, ordine, va_in_cottura, costo_abbondante, costo_senza, costo_poco,
    prep_cucina, categoria, colore)
  VALUES (NEW.tenant_id, NEW.nome, COALESCE(NEW.costo_unitario, 0), NEW.unita_misura, COALESCE(NEW.attivo, true), COALESCE(NEW.ordine, 0), COALESCE(NEW.va_in_cottura, false), NEW.costo_abbondante, NEW.costo_senza, NEW.costo_poco,
    COALESCE(NEW.prep_cucina, false), NULLIF(trim(COALESCE(NEW.categoria, '')), ''), NULLIF(trim(COALESCE(NEW.colore, '')), ''))
  RETURNING * INTO r;
  NEW.id := r.id; NEW.deleted_at := r.deleted_at;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS ingredienti_insert_trigger ON public.ingredienti;
CREATE TRIGGER ingredienti_insert_trigger INSTEAD OF INSERT ON public.ingredienti FOR EACH ROW EXECUTE FUNCTION public.ingredienti_insert();

CREATE OR REPLACE FUNCTION public.ingredienti_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.ingredienti SET
    nome = NEW.nome,
    costo_unitario = COALESCE(NEW.costo_unitario, 0),
    unita_misura = NEW.unita_misura,
    attivo = COALESCE(NEW.attivo, true),
    ordine = COALESCE(NEW.ordine, 0),
    va_in_cottura = COALESCE(NEW.va_in_cottura, false),
    costo_abbondante = NEW.costo_abbondante,
    costo_senza = NEW.costo_senza,
    costo_poco = NEW.costo_poco,
    prep_cucina = COALESCE(NEW.prep_cucina, false),
    categoria = NULLIF(trim(COALESCE(NEW.categoria, '')), ''),
    colore = NULLIF(trim(COALESCE(NEW.colore, '')), '')
  WHERE id = OLD.id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS ingredienti_update_trigger ON public.ingredienti;
CREATE TRIGGER ingredienti_update_trigger INSTEAD OF UPDATE ON public.ingredienti FOR EACH ROW EXECUTE FUNCTION public.ingredienti_update();

CREATE OR REPLACE FUNCTION public.ingredienti_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM core.ingredienti WHERE id = OLD.id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS ingredienti_delete_trigger ON public.ingredienti;
CREATE TRIGGER ingredienti_delete_trigger INSTEAD OF DELETE ON public.ingredienti FOR EACH ROW EXECUTE FUNCTION public.ingredienti_delete();

CREATE VIEW public."Ordine" AS
  SELECT id, numero, stato, totale,
         note, tipo_pagamento,
         tenant_id AS "tenantId",
         created_at AS "createdAt",
         updated_at AS "updatedAt",
         deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

CREATE VIEW public."Prodotto" AS
  SELECT id, nome, descrizione, prezzo, attivo, ordine, immagine_url,
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

-- configurazione_costi
CREATE VIEW public.configurazione_costi AS
  SELECT id, tenant_id, costo_impasto, costo_energia, created_at, updated_at
  FROM core.configurazione_costi
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE ON public.configurazione_costi TO authenticated;

-- prodotto_ingrediente
CREATE VIEW public.prodotto_ingrediente AS
  SELECT pi.id, pi.tenant_id, pi.prodotto_id, pi.ingrediente_id, pi.quantita, pi.ordine
  FROM core.prodotto_ingrediente pi
  WHERE pi.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, DELETE ON public.prodotto_ingrediente TO authenticated;

CREATE OR REPLACE FUNCTION public.prodotto_ingrediente_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO core.prodotto_ingrediente (tenant_id, prodotto_id, ingrediente_id, quantita, ordine)
  VALUES (NEW.tenant_id, NEW.prodotto_id, NEW.ingrediente_id, COALESCE(NEW.quantita, 1), COALESCE(NEW.ordine, 0));
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS prodotto_ingrediente_insert_trigger ON public.prodotto_ingrediente;
CREATE TRIGGER prodotto_ingrediente_insert_trigger INSTEAD OF INSERT ON public.prodotto_ingrediente FOR EACH ROW EXECUTE FUNCTION public.prodotto_ingrediente_insert();

CREATE OR REPLACE FUNCTION public.prodotto_ingrediente_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM core.prodotto_ingrediente
  WHERE prodotto_id = OLD.prodotto_id AND tenant_id = OLD.tenant_id AND ingrediente_id = OLD.ingrediente_id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS prodotto_ingrediente_delete_trigger ON public.prodotto_ingrediente;
CREATE TRIGGER prodotto_ingrediente_delete_trigger INSTEAD OF DELETE ON public.prodotto_ingrediente FOR EACH ROW EXECUTE FUNCTION public.prodotto_ingrediente_delete();

-- ingrediente_allergeni
CREATE TABLE IF NOT EXISTS public.ingrediente_allergeni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ingrediente_id UUID NOT NULL REFERENCES core.ingredienti(id) ON DELETE CASCADE,
    allergene_id UUID NOT NULL REFERENCES core.allergeni(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ingrediente_id, allergene_id)
);
CREATE INDEX IF NOT EXISTS idx_ingrediente_allergeni_ingrediente ON public.ingrediente_allergeni(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_ingrediente_allergeni_tenant ON public.ingrediente_allergeni(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingrediente_allergeni TO authenticated;

-- Formati (vista + trigger)
CREATE VIEW public.formati AS
  SELECT f.id, f.tenant_id, f.nome, f.prezzo, f.ordine, f.attivo, f.created_at, f.updated_at
  FROM core.formati f
  WHERE f.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formati TO authenticated;

CREATE OR REPLACE FUNCTION public.formati_insert()
RETURNS TRIGGER AS $$
DECLARE r core.formati;
BEGIN
  INSERT INTO core.formati (tenant_id, nome, prezzo, ordine, attivo)
  VALUES (NEW.tenant_id, NEW.nome, COALESCE(NEW.prezzo, 0), COALESCE(NEW.ordine, 0), COALESCE(NEW.attivo, true))
  RETURNING * INTO r;
  NEW.id := r.id; NEW.created_at := r.created_at; NEW.updated_at := r.updated_at;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS formati_insert_trigger ON public.formati;
CREATE TRIGGER formati_insert_trigger INSTEAD OF INSERT ON public.formati FOR EACH ROW EXECUTE FUNCTION public.formati_insert();

CREATE OR REPLACE FUNCTION public.formati_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.formati SET nome = NEW.nome, prezzo = COALESCE(NEW.prezzo, 0), ordine = NEW.ordine, attivo = NEW.attivo, updated_at = now() WHERE id = OLD.id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS formati_update_trigger ON public.formati;
CREATE TRIGGER formati_update_trigger INSTEAD OF UPDATE ON public.formati FOR EACH ROW EXECUTE FUNCTION public.formati_update();

CREATE OR REPLACE FUNCTION public.formati_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM core.formati WHERE id = OLD.id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS formati_delete_trigger ON public.formati;
CREATE TRIGGER formati_delete_trigger INSTEAD OF DELETE ON public.formati FOR EACH ROW EXECUTE FUNCTION public.formati_delete();

-- Cottura (vista + trigger)
CREATE VIEW public.cottura AS
  SELECT c.id, c.tenant_id, c.nome, c.ordine, c.attivo, c.created_at, c.updated_at
  FROM core.cottura c
  WHERE c.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cottura TO authenticated;

CREATE OR REPLACE FUNCTION public.cottura_insert()
RETURNS TRIGGER AS $$
DECLARE r core.cottura;
BEGIN
  INSERT INTO core.cottura (tenant_id, nome, ordine, attivo)
  VALUES (NEW.tenant_id, NEW.nome, COALESCE(NEW.ordine, 0), COALESCE(NEW.attivo, true))
  RETURNING * INTO r;
  NEW.id := r.id; NEW.created_at := r.created_at; NEW.updated_at := r.updated_at;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS cottura_insert_trigger ON public.cottura;
CREATE TRIGGER cottura_insert_trigger INSTEAD OF INSERT ON public.cottura FOR EACH ROW EXECUTE FUNCTION public.cottura_insert();

CREATE OR REPLACE FUNCTION public.cottura_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.cottura SET nome = NEW.nome, ordine = NEW.ordine, attivo = NEW.attivo, updated_at = now() WHERE id = OLD.id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS cottura_update_trigger ON public.cottura;
CREATE TRIGGER cottura_update_trigger INSTEAD OF UPDATE ON public.cottura FOR EACH ROW EXECUTE FUNCTION public.cottura_update();

CREATE OR REPLACE FUNCTION public.cottura_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM core.cottura WHERE id = OLD.id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS cottura_delete_trigger ON public.cottura;
CREATE TRIGGER cottura_delete_trigger INSTEAD OF DELETE ON public.cottura FOR EACH ROW EXECUTE FUNCTION public.cottura_delete();

-- Grant core
GRANT SELECT, INSERT, UPDATE, DELETE ON core.categorie TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.allergeni TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.impasti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.prodotto_allergeni TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.formati TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.cottura TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.prodotti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.ordini TO authenticated;

-- ============================================================
-- CLIENTI: UNIONE ACCOUNT ALLA REGISTRAZIONE
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_nome TEXT;
  v_indirizzo TEXT;
  v_telefono TEXT;
  v_email TEXT;
  v_meta JSONB;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_nome := trim(COALESCE(v_meta->>'nome', v_meta->>'full_name', ''));
  v_indirizzo := trim(COALESCE(v_meta->>'indirizzo', ''));
  v_telefono := trim(COALESCE(v_meta->>'telefono', v_meta->>'phone', ''));
  v_email := trim(COALESCE(NEW.email, ''));

  SELECT ac.tenant_id INTO v_tenant_id
  FROM public.anagrafica_clienti ac
  WHERE trim(lower(ac.nome)) = trim(lower(v_nome))
    AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(v_indirizzo))
    AND trim(COALESCE(ac.telefono, '')) = trim(v_telefono)
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    v_tenant_id := (v_meta->>'tenant_id')::UUID;
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.clienti (id, tenant_id, nome, indirizzo, telefono, email)
    VALUES (NEW.id, v_tenant_id, NULLIF(v_nome, ''), NULLIF(v_indirizzo, ''), NULLIF(v_telefono, ''), NULLIF(v_email, ''))
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- RUOLI PIZZERIA, TENANT ADMINS E RLS
-- ============================================================

DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;
CREATE VIEW public.ruoli_pizzeria AS
SELECT ur.user_id, ur.ruolo, ur.tenant_id, ur.puo_modificare_parametri, ur.attivo, u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;

CREATE TABLE IF NOT EXISTS public.tenant_admins (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_admins_tenant ON public.tenant_admins(tenant_id);
ALTER TABLE public.tenant_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_admins_select_own" ON public.tenant_admins;
CREATE POLICY "tenant_admins_select_own" ON public.tenant_admins
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.tenant_admins TO authenticated;

INSERT INTO public.tenant_admins (user_id, tenant_id)
SELECT user_id, tenant_id FROM public.utenti_ruoli WHERE ruolo = 'admin'
ON CONFLICT (user_id, tenant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_tenant_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tenant_admins WHERE user_id = OLD.user_id AND tenant_id = OLD.tenant_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF OLD IS NOT NULL AND OLD.ruolo = 'admin' THEN
      DELETE FROM public.tenant_admins WHERE user_id = OLD.user_id AND tenant_id = OLD.tenant_id;
    END IF;
    IF NEW.ruolo = 'admin' THEN
      INSERT INTO public.tenant_admins (user_id, tenant_id) VALUES (NEW.user_id, NEW.tenant_id)
      ON CONFLICT (user_id, tenant_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS tr_sync_tenant_admins ON public.utenti_ruoli;
CREATE TRIGGER tr_sync_tenant_admins
  AFTER INSERT OR UPDATE OR DELETE ON public.utenti_ruoli
  FOR EACH ROW EXECUTE PROCEDURE public.sync_tenant_admins();

DROP POLICY IF EXISTS "utenti_ruoli_select_own" ON public.utenti_ruoli;
DROP POLICY IF EXISTS "utenti_ruoli_insert_admin" ON public.utenti_ruoli;
DROP POLICY IF EXISTS "utenti_ruoli_update_admin" ON public.utenti_ruoli;

CREATE POLICY "utenti_ruoli_select_own" ON public.utenti_ruoli
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.tenant_admins a WHERE a.user_id = auth.uid() AND a.tenant_id = utenti_ruoli.tenant_id)
  );

CREATE POLICY "utenti_ruoli_insert_admin" ON public.utenti_ruoli
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_admins a WHERE a.user_id = auth.uid() AND a.tenant_id = utenti_ruoli.tenant_id)
  );

CREATE POLICY "utenti_ruoli_update_admin" ON public.utenti_ruoli
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tenant_admins a WHERE a.user_id = auth.uid() AND a.tenant_id = utenti_ruoli.tenant_id)
  );

CREATE OR REPLACE FUNCTION public.aggiungi_ruolo_pizzeria(p_email text, p_tenant_id uuid, p_ruolo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Solo un admin della pizzeria può aggiungere ruoli.';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = trim(p_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nessun utente trovato con email "%". Crea prima l''utente in Authentication (Auth → Users).', p_email;
  END IF;

  INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id)
  VALUES (v_user_id, p_ruolo, p_tenant_id)
  ON CONFLICT (user_id) DO UPDATE SET ruolo = EXCLUDED.ruolo, tenant_id = EXCLUDED.tenant_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aggiungi_ruolo_pizzeria(text, uuid, text) TO authenticated;

-- ============================================================
-- ORDINI: RPC create_order_with_items
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_ATTESA',
  p_items JSONB DEFAULT '[]',
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  INSERT INTO core.ordini (tenant_id, numero, stato, totale, note, tipo_pagamento)
  VALUES (
    p_tenant_id,
    v_numero,
    COALESCE(NULLIF(p_stato, ''), 'IN_ATTESA')::core.stato_ordine,
    p_totale,
    NULLIF(TRIM(p_note), ''),
    NULLIF(TRIM(p_tipo_pagamento), '')
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO core.riga_ordine (tenant_id, ordine_id, prodotto_id, quantita, prezzo)
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0)
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- ============================================================
-- FINE SCHEMA UNICO
-- Seed: usa npx prisma db seed o gli script commentati sotto.
-- ============================================================

/*
-- SEED primo punto vendita (dopo aver creato almeno un tenant)
INSERT INTO core.punti_vendita (tenant_id, nome, slug, attivo)
SELECT t.id, 'Sede principale', 'sede-principale', true
FROM core.tenants t
WHERE NOT EXISTS (SELECT 1 FROM core.punti_vendita pv WHERE pv.tenant_id = t.id)
ORDER BY t.created_at LIMIT 1;

-- SEED utenti_ruoli (sostituisci gli UUID con i tuoi da Supabase Auth)
INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id)
SELECT '0683a615-d08a-488d-b9df-3a486b35a461'::uuid, 'superadmin', t.id
FROM core.tenants t ORDER BY t.created_at LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET ruolo = 'superadmin', tenant_id = EXCLUDED.tenant_id;
*/
