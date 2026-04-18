-- ============================================================
-- PIZZAMANAGER – SCHEMA INTEGRAZIONI (idempotente, non distruttivo)
-- Nessuna cancellazione o rinomina di dati: solo CREATE IF NOT EXISTS,
-- ALTER ADD COLUMN IF NOT EXISTS, DROP VIEW IF EXISTS + CREATE VIEW (aggiorna definizione),
-- CREATE OR REPLACE per funzioni/trigger. Esegui su un DB con schema base (core + public).
-- Puoi rieseguire più volte senza perdita dati.
-- ============================================================

-- ########### CATEGORIE, PRODOTTI (categoria, immagine, ordine), ALLERGENI, IMPASTI ###########

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
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
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

ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS ordine INT NOT NULL DEFAULT 0;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS va_in_cottura BOOLEAN DEFAULT false;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS costo_abbondante NUMERIC(10,2);
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS costo_senza NUMERIC(10,2);
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS costo_poco NUMERIC(10,2);

ALTER TABLE core.prodotto_ingrediente ADD COLUMN IF NOT EXISTS ordine INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_prodotto_ingrediente_ordine ON core.prodotto_ingrediente(prodotto_id, ordine);

-- ########### FORMATI E COTTURA ###########

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

-- ########### TENANT – DATI PIZZERIA, ORARI, PARAMETRI ###########

ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS indirizzo TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS lng NUMERIC;
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS orari_settimana JSONB DEFAULT '[]';
ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS parametri_operativi JSONB DEFAULT '{}';

-- ########### VISTE PUBLIC: crea se non esiste, aggiorna se necessario (solo viste, mai rinomina tabelle) ###########
-- Per ogni vista: DROP VIEW IF EXISTS poi CREATE VIEW così la definizione si aggiorna senza toccare dati.

DROP VIEW IF EXISTS public.tenants CASCADE;
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

DROP VIEW IF EXISTS public.punti_vendita CASCADE;
CREATE VIEW public.punti_vendita AS
  SELECT pv.id, pv.tenant_id, pv.nome, pv.slug, pv.attivo, pv.created_at, pv.updated_at
  FROM core.punti_vendita pv
  WHERE pv.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT ON public.punti_vendita TO authenticated;

DROP VIEW IF EXISTS public."Categoria" CASCADE;
DROP VIEW IF EXISTS public.categorie CASCADE;
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

DROP VIEW IF EXISTS public."Allergene" CASCADE;
DROP VIEW IF EXISTS public.allergeni CASCADE;
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

DROP VIEW IF EXISTS public.impasti CASCADE;
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

DROP VIEW IF EXISTS public."Ingrediente" CASCADE;
DROP VIEW IF EXISTS public.ingredienti CASCADE;
CREATE VIEW public.ingredienti AS
  SELECT i.id, i.tenant_id, i.nome, i.costo_unitario, i.unita_misura, i.attivo, i.deleted_at, i.ordine, i.va_in_cottura,
         i.costo_abbondante, i.costo_senza, i.costo_poco,
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

DROP VIEW IF EXISTS public."Ordine" CASCADE;
CREATE VIEW public."Ordine" AS
  SELECT id, numero, stato, totale,
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

DROP VIEW IF EXISTS public."Prodotto" CASCADE;
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

DROP VIEW IF EXISTS public.configurazione_costi CASCADE;
CREATE VIEW public.configurazione_costi AS
  SELECT id, tenant_id, costo_impasto, costo_energia, created_at, updated_at
  FROM core.configurazione_costi
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE ON public.configurazione_costi TO authenticated;

DROP VIEW IF EXISTS public.prodotto_ingrediente CASCADE;
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

DROP VIEW IF EXISTS public.formati CASCADE;
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

DROP VIEW IF EXISTS public.cottura CASCADE;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON core.categorie TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.allergeni TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.impasti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.prodotto_allergeni TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.formati TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.cottura TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.prodotti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.ordini TO authenticated;

-- ============================================================
-- FINE SCHEMA INTEGRAZIONI
-- Aggiungi qui sotto ogni nuova integrazione con:
--   CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   DROP VIEW IF EXISTS ... CASCADE; CREATE VIEW ... (per aggiornare viste)
--   CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS; CREATE TRIGGER
-- Nessuna operazione che cancelli o rinomini tabelle con dati.
-- ============================================================

-- ########### CLIENTI: ANAGRAFICA + UNIONE ACCOUNT ###########

ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS indirizzo TEXT;
ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS email TEXT;

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
DROP POLICY IF EXISTS "anagrafica_clienti_staff_update" ON public.anagrafica_clienti;
CREATE POLICY "anagrafica_clienti_staff_update" ON public.anagrafica_clienti
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.anagrafica_clienti TO authenticated;

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

COMMENT ON TABLE public.anagrafica_clienti IS 'Anagrafica creata dalla cassa (senza account). Alla registrazione self-service con stesso nome+indirizzo+telefono si unisce l''account.';

-- ########### ORDINI: NOTE / TIPO PAGAMENTO + RPC ###########

ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_ordine TEXT;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS orario_ritiro TEXT;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS indirizzo_consegna TEXT;

COMMENT ON COLUMN core.ordini.note IS 'Note ordine (cliente o cassa)';
COMMENT ON COLUMN core.ordini.tipo_pagamento IS 'Es: Contanti, Carta, Da pagare, Altro';
COMMENT ON COLUMN core.ordini.tipo_ordine IS 'negozio | delivery';
COMMENT ON COLUMN core.ordini.nome_cliente IS 'Nome cliente (ritiro in negozio)';
COMMENT ON COLUMN core.ordini.orario_ritiro IS 'Orario ritiro/consegna (es. 22:15)';
COMMENT ON COLUMN core.ordini.indirizzo_consegna IS 'Indirizzo consegna (delivery)';

DROP VIEW IF EXISTS public."Ordine" CASCADE;
CREATE VIEW public."Ordine" AS
  SELECT id, numero, stato, totale,
         note, tipo_pagamento, tipo_ordine, nome_cliente, orario_ritiro, indirizzo_consegna,
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

-- Trigger per UPDATE su vista Ordine (modifica ordine dalla cassa)
CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
BEGIN
  UPDATE core.ordini
  SET
    note           = COALESCE(NEW.note, OLD.note),
    tipo_pagamento = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine    = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente   = NEW.nome_cliente,
    orario_ritiro  = NEW.orario_ritiro,
    indirizzo_consegna = NEW.indirizzo_consegna,
    updated_at     = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW EXECUTE FUNCTION public.ordine_instead_of_update();

-- RigaOrdine: formato_nome (Famiglia, Mezzo metro, Metro) + riepilogo ingredienti per riga
ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS formato_nome TEXT;
COMMENT ON COLUMN core.riga_ordine.formato_nome IS 'Formato pizza: Famiglia, Mezzo metro, Metro (formati speciali cassa)';
ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS ingredienti_cottura_summary TEXT;
COMMENT ON COLUMN core.riga_ordine.ingredienti_cottura_summary IS 'Riepilogo ingredienti/modifiche/cottura per questa riga (generato dalla cassa).';

DROP VIEW IF EXISTS public."RigaOrdine" CASCADE;
CREATE VIEW public."RigaOrdine" AS
  SELECT
    r.id,
    r.tenant_id AS "tenantId",
    r.ordine_id AS "ordineId",
    r.prodotto_id AS "prodottoId",
    r.quantita,
    r.prezzo,
    r.formato_nome AS "formatoNome",
    r.ingredienti_cottura_summary AS "ingredientiCotturaSummary"
  FROM core.riga_ordine r
  WHERE r.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT ON public."RigaOrdine" TO authenticated;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_ATTESA',
  p_items JSONB DEFAULT '[]',
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
AS $$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  INSERT INTO core.ordini (tenant_id, numero, stato, totale, note, tipo_pagamento, tipo_ordine, nome_cliente, orario_ritiro, indirizzo_consegna)
  VALUES (
    p_tenant_id,
    v_numero,
    COALESCE(NULLIF(p_stato, ''), 'IN_ATTESA')::core.stato_ordine,
    p_totale,
    NULLIF(TRIM(p_note), ''),
    NULLIF(TRIM(p_tipo_pagamento), ''),
    NULLIF(TRIM(p_tipo_ordine), ''),
    NULLIF(TRIM(p_nome_cliente), ''),
    NULLIF(TRIM(p_orario_ritiro), ''),
    NULLIF(TRIM(p_indirizzo_consegna), '')
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
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
      NULLIF(TRIM(COALESCE(v_item->>'formato_nome', v_item->>'formatoNome', '')), ''),
      NULLIF(
        TRIM(
          COALESCE(
            v_item->>'ingredienti_cottura_summary',
            v_item->>'ingredientiCotturaSummary',
            ''
          )
        ),
        ''
      )
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ########### RUOLI PIZZERIA, TENANT ADMINS, RLS ###########

ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS puo_modificare_parametri BOOLEAN DEFAULT false;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS attivo BOOLEAN DEFAULT true;
-- Aree accessibili per utente (se true o null = accesso consentito; false = disabilitato)
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_riepilogo BOOLEAN DEFAULT true;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_cassa BOOLEAN DEFAULT true;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_cucina BOOLEAN DEFAULT true;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_bancone BOOLEAN DEFAULT true;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_delivery BOOLEAN DEFAULT true;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_pony BOOLEAN DEFAULT true;
ALTER TABLE public.utenti_ruoli ADD COLUMN IF NOT EXISTS accesso_pizzaiolo BOOLEAN DEFAULT true;

DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;
CREATE VIEW public.ruoli_pizzeria AS
SELECT ur.user_id, ur.ruolo, ur.tenant_id, ur.puo_modificare_parametri, ur.attivo,
       ur.accesso_riepilogo, ur.accesso_cassa, ur.accesso_cucina, ur.accesso_bancone, ur.accesso_delivery, ur.accesso_pony, ur.accesso_pizzaiolo,
       u.email
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

-- ########### CHIUSURA GIORNATA E CONTABILITÀ ###########
-- Salvataggio per contabilità: export lato client (download JSON).
-- Chiusura giornata: inserisce record per tracciare il reset dello storico giornaliero.

CREATE TABLE IF NOT EXISTS public.chiusure_giornata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT current_date,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, data)
);
CREATE INDEX IF NOT EXISTS idx_chiusure_giornata_tenant ON public.chiusure_giornata(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chiusure_giornata_data ON public.chiusure_giornata(tenant_id, data);
ALTER TABLE public.chiusure_giornata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chiusure_giornata_staff" ON public.chiusure_giornata;
CREATE POLICY "chiusure_giornata_staff" ON public.chiusure_giornata
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );
GRANT SELECT, INSERT ON public.chiusure_giornata TO authenticated;

CREATE OR REPLACE FUNCTION public.chiudi_giornata(p_tenant_id UUID, p_data DATE DEFAULT current_date, p_payload JSONB DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Non autorizzato per questo tenant.';
  END IF;
  INSERT INTO public.chiusure_giornata (tenant_id, data, payload)
  VALUES (p_tenant_id, p_data, p_payload)
  ON CONFLICT (tenant_id, data) DO UPDATE SET payload = COALESCE(EXCLUDED.payload, chiusure_giornata.payload), created_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.chiudi_giornata(uuid, date, jsonb) TO authenticated;

