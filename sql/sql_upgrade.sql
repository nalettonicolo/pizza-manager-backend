-- =============================================================================
-- PizzaManager — SQL UPGRADE (modifiche successive al baseline)
-- =============================================================================
--
-- Baseline completo (nuovo DB o allineamento totale): eseguire per primo
--   sql/schema_completo_pizzamanager.sql
--   (include ex snapshot remoto + tutte le patch che erano in supabase/migrations/).
--
-- Non fanno parte di questo flusso Supabase/Postgres: server/pizzeria-backend/prisma/*.sql
-- (migrazioni Prisma), struttura_pizzeria.sql (snapshot storico locale).
--
-- Questo file è il punto unico per le nuove DDL/DML incrementali: preferire
-- blocchi idempotenti (IF NOT EXISTS, DO $$ … $$, DROP … IF EXISTS dove sicuro).
-- Le patch che toccano Ordine / create_order_with_items / replace_order_items vanno
-- incluse qui (non solo nei moduli sotto sql/modules/), così un'unica esecuzione basta.
--
-- Changelog (estratto):
--   2026-04-11 — RLS su core.* tenant-sensitive: funzione pm_core_tenant_access + policy
--     authenticated (superadmin, staff/clienti, rider auth_user_id); menu pubblico su
--     core.prodotti invariato (anon_select_*); revoche backup/_prisma; RLS ingrediente_allergeni.
--   2026-04-11 — Moduli sql/modules/ 01–11 inclusi all'inizio del file (ordine esecuzione).
--   2026-04-11 — public.replace_order_items: modifica righe ordine dalla cassa
--     (sostituisce righe, totale, azzera cucina_prep_stato; staff cassa / accesso_cassa).
--   2026-04 — public.utenti_ruoli.nome_visualizzato + vista ruoli_pizzeria aggiornata.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Moduli sql/modules (01–11): stesso contenuto dei file in sql/modules/ (ordine).
-- 04–05–12–13: la logica Ordine/create_order e fiscal è nelle sezioni successive;
--    il file 13_ordine_telefono_ritiro.sql è solo nota (nessun SQL).
-- Attenzione: 02/10 fanno DROP VIEW public.punti_vendita — non usare se quella
--    relazione è ancora una TABLE legacy (solo VIEW).
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1) FIDELITY + DEFAULT PARAMETRI TENANT
-- =============================================================================

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

ALTER TABLE public.fidelity_saldi
  ADD COLUMN IF NOT EXISTS nome_negozio TEXT;

COMMENT ON COLUMN public.fidelity_saldi.nome_negozio IS
  'Nome come lo chiami in negozio (bancone); opzionale, affiancato al codice carta.';

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
-- 2) core.punti_vendita (multi-sede) + vista public se assente
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.punti_vendita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punti_vendita_tenant ON core.punti_vendita(tenant_id);

ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS consegna_area_poligono JSONB;
COMMENT ON COLUMN core.punti_vendita.consegna_area_poligono IS 'GeoJSON Polygon WGS84; se NULL in checkout si usa parametri_operativi.consegna_area_poligono del tenant.';

DROP VIEW IF EXISTS public.punti_vendita CASCADE;
CREATE VIEW public.punti_vendita AS
  SELECT
    pv.id,
    pv.tenant_id,
    pv.nome,
    pv.slug,
    pv.attivo,
    pv.consegna_area_poligono,
    pv.created_at,
    pv.updated_at
  FROM core.punti_vendita pv
  WHERE pv.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT ON public.punti_vendita TO authenticated;
GRANT SELECT ON public.punti_vendita TO anon;




-- =============================================================================
-- 3) Estensioni core.ordini
-- Logistica rider enterprise (rider_id, percorsi, stato_delivery enum): modulo 11.
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
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS turno_operatori_id INTEGER;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS telefono_ritiro TEXT;

  COMMENT ON COLUMN core.ordini.telefono_ritiro IS 'Telefono contatto per ritiro in negozio (opzionale, es. ordine telefonico).';

  COMMENT ON COLUMN core.ordini.consegna_lng IS 'Longitudine indirizzo consegna (verifica area / tracciamento).';
  COMMENT ON COLUMN core.ordini.consegna_lat IS 'Latitudine indirizzo consegna.';
  COMMENT ON COLUMN core.ordini.pagamento_dettaglio IS 'Pagamento misto: es. [{"tipo":"Contanti","importo":10},{"tipo":"Carta","importo":5}].';
  COMMENT ON COLUMN core.ordini.stato_consegna IS 'Delivery: es. RICHIESTA, IN_PREPARAZIONE, IN_VIAGGIO, CONSEGNATO.';
  COMMENT ON COLUMN core.ordini.punto_vendita_id IS 'Punto vendita (core.punti_vendita) se multi-PV.';
  COMMENT ON COLUMN core.ordini.turno_operatori_id IS 'Turno cassa aperto (public.turni_operatori.id) al momento dell''ordine; null per ordini web o senza turno.';

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'turni_operatori'
      AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ordini_turno_operatori_id_fkey'
    ) THEN
      ALTER TABLE core.ordini
        ADD CONSTRAINT ordini_turno_operatori_id_fkey
        FOREIGN KEY (turno_operatori_id) REFERENCES public.turni_operatori (id) ON DELETE SET NULL;
    END IF;
  END IF;

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




-- =============================================================================
-- 6) Contabilità: movimenti manuali su DB (alternativa / affiancamento a localStorage)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contabilita_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  data_mov DATE NOT NULL,
  descrizione TEXT,
  importo NUMERIC(12, 2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('contanti', 'elettronico')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_movimenti_tenant_data
  ON public.contabilita_movimenti(tenant_id, data_mov DESC);

ALTER TABLE public.contabilita_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabilita_movimenti_staff_all" ON public.contabilita_movimenti;
CREATE POLICY "contabilita_movimenti_staff_all" ON public.contabilita_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_movimenti TO authenticated;

COMMENT ON TABLE public.contabilita_movimenti IS
  'Incassi manuali registrati da Admin (contanti / elettronico); usabile al posto del solo localStorage.';




-- =============================================================================
-- 7) Magazzino: movimenti di magazzino (base incrementale)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.magazzino_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  prodotto_id UUID,
  descrizione TEXT NOT NULL,
  qty_delta NUMERIC(14, 3) NOT NULL,
  unita TEXT DEFAULT 'pz',
  riferimento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magazzino_movimenti_tenant ON public.magazzino_movimenti(tenant_id, created_at DESC);

ALTER TABLE public.magazzino_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magazzino_movimenti_staff_all" ON public.magazzino_movimenti;
CREATE POLICY "magazzino_movimenti_staff_all" ON public.magazzino_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazzino_movimenti TO authenticated;

COMMENT ON TABLE public.magazzino_movimenti IS
  'Movimenti di carico/scarico; prodotto_id opzionale se il movimento è aggregato o non legato al listino.';




-- =============================================================================
-- 8) Seed: un punto vendita predefinito per tenant senza sedi (multi-PV / cassa)
-- =============================================================================

INSERT INTO core.punti_vendita (tenant_id, nome, slug, attivo)
SELECT t.id, 'Sede principale', 'principale', true
FROM core.tenants t
WHERE NOT EXISTS (SELECT 1 FROM core.punti_vendita pv WHERE pv.tenant_id = t.id);




-- =============================================================================
-- 9) Vetrina cliente: campi normativi e pagamenti (policy HTML + Stripe/SumUp predisposizione)
-- =============================================================================

DO $legal$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS legal_ragione_sociale TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS legal_piva TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS legal_pec TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS privacy_policy_html TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS cookie_policy_html TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS pagamento_online_provider TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sumup_merchant_public_id TEXT';
    COMMENT ON COLUMN admin.tenants.privacy_policy_html IS 'HTML informativa privacy vetrina; se NULL si usa testo predefinito app.';
    COMMENT ON COLUMN admin.tenants.cookie_policy_html IS 'HTML cookie policy vetrina; se NULL si usa testo predefinito app.';
    COMMENT ON COLUMN admin.tenants.pagamento_online_provider IS 'stripe | sumup | null — checkout pubblico.';
    COMMENT ON COLUMN admin.tenants.stripe_publishable_key IS 'Chiave pubblica Stripe (pk_...), sicura in client.';
  END IF;
END
$legal$;

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
      parametri_operativi,
      legal_ragione_sociale,
      legal_piva,
      legal_pec,
      privacy_policy_html,
      cookie_policy_html,
      pagamento_online_provider,
      stripe_publishable_key,
      sumup_merchant_public_id
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



-- =============================================================================
-- 8) punti_vendita: coordinate sede (centro mappa / marcatore area consegna)
-- =============================================================================

ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
COMMENT ON COLUMN core.punti_vendita.lat IS 'Latitudine sede (centro mappa e marcatore in admin aree consegna).';
COMMENT ON COLUMN core.punti_vendita.lng IS 'Longitudine sede (centro mappa e marcatore in admin aree consegna).';

DROP VIEW IF EXISTS public.punti_vendita CASCADE;
CREATE VIEW public.punti_vendita AS
  SELECT
    pv.id,
    pv.tenant_id,
    pv.nome,
    pv.slug,
    pv.attivo,
    pv.consegna_area_poligono,
    pv.lat,
    pv.lng,
    pv.created_at,
    pv.updated_at
  FROM core.punti_vendita pv
  WHERE pv.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT ON public.punti_vendita TO authenticated;
GRANT SELECT ON public.punti_vendita TO anon;


-- =============================================================================
-- 11) Rider / consegne enterprise — anagrafica rider, turni, percorsi, eventi
-- =============================================================================
-- Regola A (logistica): il flag bloccato_cucina su consegna_percorso_ordine indica
-- ordini non riordinabili al ricalcolo percorso (es. già in forno).
--
-- Dipendenze: core.tenants, core.ordini, core.punti_vendita (opzionale), core.users (opzionale)
-- Prerequisiti progetto: 03_ordini_extensions.sql (tipo_ordine, stato_consegna, coordinate, turno cassa, …)
-- Allineamento: supabase/migrations/20260408120000_rider_delivery_enterprise.sql
-- =============================================================================

-- --- Enum stato logistica delivery (affianca stato_consegna TEXT legacy) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'core' AND t.typname = 'stato_delivery') THEN
    CREATE TYPE core.stato_delivery AS ENUM (
      'DA_ASSEGNARE',
      'ASSEGNATO',
      'IN_ATTESA_BANCONE',
      'IN_VIAGGIO',
      'PRESSO_CLIENTE',
      'CONSEGNATO',
      'ANOMALIA'
    );
  END IF;
END $$;

COMMENT ON TYPE core.stato_delivery IS
  'Ciclo consegna rider (affianca core.ordini.stato_consegna TEXT per compatibilità).';

-- --- Rider -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.rider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome_display TEXT NOT NULL,
  telefono TEXT,
  attivo BOOLEAN NOT NULL DEFAULT true,
  veicolo_tipo TEXT,
  note TEXT,
  staff_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rider_almeno_un_utente CHECK (
    staff_user_id IS NOT NULL OR auth_user_id IS NOT NULL OR length(trim(nome_display)) > 0
  )
);

ALTER TABLE core.rider ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_auth_tenant
  ON core.rider (tenant_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rider_tenant_attivo ON core.rider (tenant_id) WHERE attivo = true AND deleted_at IS NULL;

COMMENT ON TABLE core.rider IS 'Operatori consegna per tenant (app rider o staff).';
COMMENT ON COLUMN core.rider.staff_user_id IS 'Operatore backoffice core.users, se presente.';
COMMENT ON COLUMN core.rider.auth_user_id IS 'Login Supabase auth.users per app rider nativa.';

-- --- Turno operativo rider (distinto dal turno cassa) ------------------------
CREATE TABLE IF NOT EXISTS core.turno_rider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES core.rider(id) ON DELETE CASCADE,
  punto_vendita_id UUID REFERENCES core.punti_vendita(id) ON DELETE SET NULL,
  stato TEXT NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto', 'chiuso')),
  aperto_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  chiuso_il TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_turno_rider_tenant_aperto
  ON core.turno_rider (tenant_id, rider_id)
  WHERE stato = 'aperto' AND chiuso_il IS NULL;

COMMENT ON TABLE core.turno_rider IS 'Turno operativo rider (apertura/chiusura giornata o servizio).';

-- --- Percorso (versionato; regola A su righe ordine) -------------------------
CREATE TABLE IF NOT EXISTS core.consegna_percorso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES core.rider(id) ON DELETE CASCADE,
  turno_rider_id UUID REFERENCES core.turno_rider(id) ON DELETE SET NULL,
  versione INT NOT NULL DEFAULT 1,
  stato TEXT NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'attivo', 'completato', 'sostituito', 'annullato')),
  provider TEXT,
  geometria JSONB,
  durata_stimata_sec INT,
  distanza_metri NUMERIC(12, 2),
  creato_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  chiuso_at TIMESTAMPTZ,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consegna_percorso_tenant_rider
  ON core.consegna_percorso (tenant_id, rider_id, creato_at DESC);

COMMENT ON TABLE core.consegna_percorso IS 'Piano di consegna (ricalcoli → nuova riga o versione).';
COMMENT ON COLUMN core.consegna_percorso.geometria IS 'Polyline/geojson o risposta provider (opzionale).';

-- --- Ordini nel percorso (sequenza + blocco cucina) --------------------------
CREATE TABLE IF NOT EXISTS core.consegna_percorso_ordine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  percorso_id UUID NOT NULL REFERENCES core.consegna_percorso(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  sequenza INT NOT NULL CHECK (sequenza >= 1),
  bloccato_cucina BOOLEAN NOT NULL DEFAULT false,
  eta_minuti INT,
  dwell_secondi INT,
  note TEXT,
  UNIQUE (percorso_id, ordine_id),
  UNIQUE (percorso_id, sequenza)
);

CREATE INDEX IF NOT EXISTS idx_percorso_ordine_ordine ON core.consegna_percorso_ordine (ordine_id);

COMMENT ON COLUMN core.consegna_percorso_ordine.bloccato_cucina IS
  'Se true, il ricalcolo percorso non deve spostare/riordinare questo ordine (regola A: es. in forno).';

-- --- Ultima posizione rider --------------------------------------------------
CREATE TABLE IF NOT EXISTS core.rider_posizione (
  rider_id UUID PRIMARY KEY REFERENCES core.rider(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  aggiornato_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_posizione_aggiornato ON core.rider_posizione (aggiornato_at DESC);

-- --- Eventi / audit consegna -------------------------------------------------
CREATE TABLE IF NOT EXISTS core.ordine_consegna_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  percorso_id UUID REFERENCES core.consegna_percorso(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ordine_consegna_evento_tenant_created
  ON core.ordine_consegna_evento (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordine_consegna_evento_ordine
  ON core.ordine_consegna_evento (ordine_id, created_at DESC);

COMMENT ON TABLE core.ordine_consegna_evento IS 'Append-only: transizioni stato, ricalcoli percorso, note operative.';

-- --- Outbox notifiche (push / worker Edge) -----------------------------------
CREATE TABLE IF NOT EXISTS public.notifiche_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  stato TEXT NOT NULL DEFAULT 'in_coda' CHECK (stato IN ('in_coda', 'inviato', 'fallito', 'annullato')),
  tentativi INT NOT NULL DEFAULT 0,
  ultimo_errore TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  inviato_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifiche_outbox_tenant_stato
  ON public.notifiche_outbox (tenant_id, stato, created_at)
  WHERE stato = 'in_coda';

COMMENT ON TABLE public.notifiche_outbox IS 'Coda notifiche (FCM/email) per processamento Edge/cron.';

-- --- Estensioni core.ordini ----------------------------------------------------
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto colonne rider.';
    RETURN;
  END IF;

  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES core.rider(id) ON DELETE SET NULL;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS turno_rider_id UUID REFERENCES core.turno_rider(id) ON DELETE SET NULL;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS percorso_attivo_id UUID REFERENCES core.consegna_percorso(id) ON DELETE SET NULL;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS stato_delivery core.stato_delivery;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS assegnato_rider_at TIMESTAMPTZ;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS ritiro_bancone_rider_at TIMESTAMPTZ;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS consegna_effettiva_at TIMESTAMPTZ;

  COMMENT ON COLUMN core.ordini.rider_id IS 'Rider assegnato all''ordine delivery.';
  COMMENT ON COLUMN core.ordini.turno_rider_id IS 'Turno rider di riferimento (opzionale).';
  COMMENT ON COLUMN core.ordini.percorso_attivo_id IS 'Ultimo percorso attivo noto per l''ordine.';
  COMMENT ON COLUMN core.ordini.stato_delivery IS 'Stato logistica (enum); affianca stato_consegna TEXT legacy.';
  COMMENT ON COLUMN core.ordini.assegnato_rider_at IS 'Quando l''ordine è stato assegnato al rider.';
  COMMENT ON COLUMN core.ordini.ritiro_bancone_rider_at IS 'Quando il rider ha ritirato la merce al bancone.';
  COMMENT ON COLUMN core.ordini.consegna_effettiva_at IS 'Consegna al cliente completata.';
END $$;

DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RETURN;
  END IF;
  CREATE INDEX IF NOT EXISTS idx_ordini_tenant_rider_delivery
    ON core.ordini (tenant_id, rider_id)
    WHERE rider_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_ordini_tenant_stato_delivery
    ON core.ordini (tenant_id, stato_delivery)
    WHERE stato_delivery IS NOT NULL;
END $$;

-- Backfill stato_delivery da stato_consegna (best-effort; richiede colonne da sql/modules/03_ordini_extensions.sql)
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'ordini' AND column_name = 'tipo_ordine'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'ordini' AND column_name = 'stato_consegna'
  ) THEN
    RETURN;
  END IF;
  UPDATE core.ordini o
  SET stato_delivery = v.mapped
  FROM (
    SELECT id,
      CASE upper(trim(COALESCE(stato_consegna, '')))
        WHEN 'CONSEGNATO' THEN 'CONSEGNATO'::core.stato_delivery
        WHEN 'IN_VIAGGIO' THEN 'IN_VIAGGIO'::core.stato_delivery
        WHEN 'RICHIESTA' THEN 'DA_ASSEGNARE'::core.stato_delivery
        WHEN '' THEN 'DA_ASSEGNARE'::core.stato_delivery
        ELSE NULL
      END AS mapped
    FROM core.ordini
    WHERE tipo_ordine IS NOT NULL AND lower(trim(tipo_ordine)) = 'delivery'
  ) v
  WHERE o.id = v.id AND o.stato_delivery IS NULL AND v.mapped IS NOT NULL;
END $$;

-- --- RLS core.* (staff tenant via utenti_ruoli) --------------------------------
ALTER TABLE core.rider ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.turno_rider ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.consegna_percorso ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.consegna_percorso_ordine ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.rider_posizione ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ordine_consegna_evento ENABLE ROW LEVEL SECURITY;

-- Rider
DROP POLICY IF EXISTS rider_select_staff ON core.rider;
CREATE POLICY rider_select_staff ON core.rider FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS rider_modify_staff ON core.rider;
CREATE POLICY rider_modify_staff ON core.rider FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- turno_rider
DROP POLICY IF EXISTS turno_rider_select_staff ON core.turno_rider;
CREATE POLICY turno_rider_select_staff ON core.turno_rider FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = turno_rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS turno_rider_modify_staff ON core.turno_rider;
CREATE POLICY turno_rider_modify_staff ON core.turno_rider FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = turno_rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = turno_rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- consegna_percorso
DROP POLICY IF EXISTS consegna_percorso_select_staff ON core.consegna_percorso;
CREATE POLICY consegna_percorso_select_staff ON core.consegna_percorso FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = consegna_percorso.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS consegna_percorso_modify_staff ON core.consegna_percorso;
CREATE POLICY consegna_percorso_modify_staff ON core.consegna_percorso FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = consegna_percorso.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = consegna_percorso.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- consegna_percorso_ordine (tenant via join percorso)
DROP POLICY IF EXISTS consegna_percorso_ordine_select_staff ON core.consegna_percorso_ordine;
CREATE POLICY consegna_percorso_ordine_select_staff ON core.consegna_percorso_ordine FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.consegna_percorso p
    JOIN public.utenti_ruoli ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = consegna_percorso_ordine.percorso_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS consegna_percorso_ordine_modify_staff ON core.consegna_percorso_ordine;
CREATE POLICY consegna_percorso_ordine_modify_staff ON core.consegna_percorso_ordine FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.consegna_percorso p
    JOIN public.utenti_ruoli ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = consegna_percorso_ordine.percorso_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM core.consegna_percorso p
    JOIN public.utenti_ruoli ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = consegna_percorso_ordine.percorso_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));

-- rider_posizione (tenant via rider)
DROP POLICY IF EXISTS rider_posizione_select_staff ON core.rider_posizione;
CREATE POLICY rider_posizione_select_staff ON core.rider_posizione FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.rider r
    JOIN public.utenti_ruoli ur ON ur.tenant_id = r.tenant_id
    WHERE r.id = rider_posizione.rider_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS rider_posizione_modify_staff ON core.rider_posizione;
CREATE POLICY rider_posizione_modify_staff ON core.rider_posizione FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.rider r
    JOIN public.utenti_ruoli ur ON ur.tenant_id = r.tenant_id
    WHERE r.id = rider_posizione.rider_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM core.rider r
    JOIN public.utenti_ruoli ur ON ur.tenant_id = r.tenant_id
    WHERE r.id = rider_posizione.rider_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));

-- ordine_consegna_evento
DROP POLICY IF EXISTS ordine_consegna_evento_select_staff ON core.ordine_consegna_evento;
CREATE POLICY ordine_consegna_evento_select_staff ON core.ordine_consegna_evento FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = ordine_consegna_evento.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS ordine_consegna_evento_insert_staff ON core.ordine_consegna_evento;
CREATE POLICY ordine_consegna_evento_insert_staff ON core.ordine_consegna_evento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = ordine_consegna_evento.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- Outbox: solo staff; niente UPDATE da client (worker usa service role)
ALTER TABLE public.notifiche_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifiche_outbox_select_staff ON public.notifiche_outbox;
CREATE POLICY notifiche_outbox_select_staff ON public.notifiche_outbox FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = notifiche_outbox.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS notifiche_outbox_insert_staff ON public.notifiche_outbox;
CREATE POLICY notifiche_outbox_insert_staff ON public.notifiche_outbox FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = notifiche_outbox.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON core.rider TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.turno_rider TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.consegna_percorso TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.consegna_percorso_ordine TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.rider_posizione TO authenticated;
GRANT SELECT, INSERT ON core.ordine_consegna_evento TO authenticated;
GRANT SELECT, INSERT ON public.notifiche_outbox TO authenticated;


-- -----------------------------------------------------------------------------
-- Patch: fiscal_outbox + payment_link_intents (modulo 12 — stesso contenuto di
-- sql/modules/12_fiscal_outbox_payment_links.sql)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fiscal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID REFERENCES core.ordini(id) ON DELETE SET NULL,
  punto_vendita_id UUID,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'corrispettivo_rt',
      'chiusura_giornaliera_rt',
      'annullo_rt',
      'sdi_fattura',
      'sdi_nota_credito',
      'export_file',
      'noop_test'
    )
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'ack', 'failed', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  payload_canonical JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_key TEXT,
  provider_request JSONB,
  provider_response JSONB,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fiscal_outbox_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_tenant_status
  ON public.fiscal_outbox(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_ordine
  ON public.fiscal_outbox(ordine_id)
  WHERE ordine_id IS NOT NULL;

COMMENT ON TABLE public.fiscal_outbox IS
  'Coda fiscal: corrispettivi RT, chiusure, SDI, export. Adapter esterni mappano payload_canonical → fornitore.';

COMMENT ON COLUMN public.fiscal_outbox.payload_canonical IS
  'Payload interno stabile (importi, righe, aliquote, riferimenti ordine) prima del mapping verso il provider.';

COMMENT ON COLUMN public.fiscal_outbox.provider_key IS
  'Identificativo implementazione: es. rtmiddleware_acme, export_xml_v1, noop.';

CREATE TABLE IF NOT EXISTS public.payment_link_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  importo_cent BIGINT NOT NULL CHECK (importo_cent > 0),
  valuta TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'opened', 'paid', 'failed', 'expired', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  destinatario_telefono TEXT,
  payment_url TEXT,
  provider_key TEXT,
  provider_intent_id TEXT,
  provider_payload JSONB,
  last_error TEXT,
  sms_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_link_intents_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_tenant_status
  ON public.payment_link_intents(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_ordine
  ON public.payment_link_intents(ordine_id);

COMMENT ON TABLE public.payment_link_intents IS
  'Intent pay-by-link: generazione URL, invio SMS, stato da webhook PSP.';

ALTER TABLE public.fiscal_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_link_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_outbox_staff_all" ON public.fiscal_outbox;
CREATE POLICY "fiscal_outbox_staff_all" ON public.fiscal_outbox
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "payment_link_intents_staff_all" ON public.payment_link_intents;
CREATE POLICY "payment_link_intents_staff_all" ON public.payment_link_intents
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_intents TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_fiscal_outbox_updated ON public.fiscal_outbox;
CREATE TRIGGER tr_fiscal_outbox_updated
  BEFORE UPDATE ON public.fiscal_outbox
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

DROP TRIGGER IF EXISTS tr_payment_link_intents_updated ON public.payment_link_intents;
CREATE TRIGGER tr_payment_link_intents_updated
  BEFORE UPDATE ON public.payment_link_intents
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- -----------------------------------------------------------------------------
-- telefono_ritiro + vista public."Ordine" + RPC create_order_with_items
-- (allineato a sql/modules/04_ordine_view_trigger.sql e 05_pm_point_create_order.sql)
-- -----------------------------------------------------------------------------

ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS telefono_ritiro TEXT;
COMMENT ON COLUMN core.ordini.telefono_ritiro IS 'Telefono contatto per ritiro in negozio (opzionale).';

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = COALESCE(NEW.nome_cliente, OLD.nome_cliente),
    telefono_ritiro    = COALESCE(NEW.telefono_ritiro, OLD.telefono_ritiro),
    orario_ritiro      = COALESCE(NEW.orario_ritiro, OLD.orario_ritiro),
    indirizzo_consegna = COALESCE(NEW.indirizzo_consegna, OLD.indirizzo_consegna),
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();

CREATE OR REPLACE FUNCTION public.pm_point_in_ring(
  p_lng double precision,
  p_lat double precision,
  p_ring jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $ring$
DECLARE
  n int;
  i int;
  j int;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  inside boolean := false;
BEGIN
  IF p_ring IS NULL OR jsonb_typeof(p_ring) <> 'array' THEN
    RETURN NULL;
  END IF;

  n := jsonb_array_length(p_ring);
  IF n < 4 THEN
    RETURN NULL;
  END IF;

  IF (p_ring->0->>0)::double precision = (p_ring->(n - 1)->>0)::double precision
     AND (p_ring->0->>1)::double precision = (p_ring->(n - 1)->>1)::double precision THEN
    n := n - 1;
  END IF;

  IF n < 3 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..(n - 1) LOOP
    j := (i + 1) % n;
    xi := (p_ring->i->>0)::double precision;
    yi := (p_ring->i->>1)::double precision;
    xj := (p_ring->j->>0)::double precision;
    yj := (p_ring->j->>1)::double precision;
    IF (yi > p_lat) <> (yj > p_lat) THEN
      IF p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi THEN
        inside := NOT inside;
      END IF;
    END IF;
  END LOOP;

  RETURN inside;
END;
$ring$;

COMMENT ON FUNCTION public.pm_point_in_ring(double precision, double precision, jsonb) IS
  'Ray casting: punto [lng,lat] dentro anello poligonale GeoJSON (primo anello).';

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
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL,
  p_pagamento_dettaglio JSONB DEFAULT NULL,
  p_punto_vendita_id UUID DEFAULT NULL,
  p_turno_operatori_id INTEGER DEFAULT NULL,
  p_telefono_ritiro TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
  v_turno_pv uuid;
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

  v_po := NULL;
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('core.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM core.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna Ã¨ fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  IF p_turno_operatori_id IS NOT NULL THEN
    IF to_regclass('public.turni_operatori') IS NULL THEN
      RAISE EXCEPTION 'turni_operatori non disponibile sul database';
    END IF;
    SELECT t.punto_vendita_id INTO v_turno_pv
    FROM public.turni_operatori t
    WHERE t.id = p_turno_operatori_id
      AND t.tenant_id = p_tenant_id
      AND t.user_id = auth.uid()
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'turno_non_valido';
    END IF;
    IF p_punto_vendita_id IS NOT NULL AND v_turno_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_punto_vendita_mismatch';
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id,
    turno_operatori_id
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
    NULLIF(trim(COALESCE(p_telefono_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id,
    p_turno_operatori_id
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
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) IS
  'Crea ordine + righe. Delivery+poligono: clienti con lng/lat in area; staff cassa esentato. telefono_ritiro opzionale (ritiro negozio).';

-- -----------------------------------------------------------------------------
-- Sostituisce tutte le righe di un ordine (modifica cassa). Transazionale.
-- Richiede utente con ruolo cassa o accesso_cassa sul tenant dellâ€™ordine.
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.replace_order_items(UUID, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.replace_order_items(
  p_ordine_id UUID,
  p_totale NUMERIC,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $rep$
DECLARE
  v_tenant_id UUID;
  v_stato core.stato_ordine;
  v_item JSONB;
  v_is_staff_cassa BOOLEAN;
  v_pid UUID;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id, o.stato INTO v_tenant_id, v_stato
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  IF v_stato = 'ANNULLATO'::core.stato_ordine THEN
    RAISE EXCEPTION 'ordine_annullato_non_modificabile';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_is_staff_cassa;

  IF NOT v_is_staff_cassa THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'almeno_una_riga';
  END IF;

  DELETE FROM core.riga_ordine
  WHERE ordine_id = p_ordine_id
    AND tenant_id = v_tenant_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := NULL;
    BEGIN
      v_pid := (v_item->>'prodotto_id')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'prodotto_id_non_valido';
    END;

    IF v_pid IS NULL THEN
      RAISE EXCEPTION 'prodotto_id_obbligatorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM core.prodotti p
      WHERE p.id = v_pid
        AND p.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'prodotto_non_valido';
    END IF;

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
      v_tenant_id,
      p_ordine_id,
      v_pid,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(
        trim(COALESCE(v_item->>'formato_nome', v_item->>'formatoNome', '')),
        ''
      ),
      NULLIF(
        trim(
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

  UPDATE core.ordini
  SET
    totale = p_totale,
    updated_at = now(),
    cucina_prep_stato = '{}'::jsonb
  WHERE id = p_ordine_id
    AND tenant_id = v_tenant_id;
END;
$rep$;

GRANT EXECUTE ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) TO authenticated;

COMMENT ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) IS
  'Cassa: sostituisce righe ordine, ricalcola totale, azzera cucina_prep_stato (nuovi id riga).';

-- -----------------------------------------------------------------------------
-- Ingredienti: prep_cucina (lista lavorazioni in schermata Cucina)
-- Ordini: cucina_prep_stato JSONB { "doneByRiga": { "riga_uuid": ["ing_uuid"] } }
-- -----------------------------------------------------------------------------

ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN core.ingredienti.prep_cucina IS
  'Se true, la cucina prepara questo ingrediente in anticipo (es. scongelare); stato per riga ordine in ordini.cucina_prep_stato.';

ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS cucina_prep_stato JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN core.ordini.cucina_prep_stato IS
  'Preparazioni cucina: doneByRiga mappa id riga ordine -> array id ingredienti segnati come pronti.';

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = COALESCE(NEW.nome_cliente, OLD.nome_cliente),
    telefono_ritiro    = COALESCE(NEW.telefono_ritiro, OLD.telefono_ritiro),
    orario_ritiro      = COALESCE(NEW.orario_ritiro, OLD.orario_ritiro),
    indirizzo_consegna = COALESCE(NEW.indirizzo_consegna, OLD.indirizzo_consegna),
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    cucina_prep_stato  = COALESCE(NEW.cucina_prep_stato, OLD.cucina_prep_stato),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
    cucina_prep_stato,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();

-- -----------------------------------------------------------------------------
-- Prodotti: prep_cucina (task in Cucina per fritti, bibite, dolci, ecc.)
-- -----------------------------------------------------------------------------

ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN core.prodotti.prep_cucina IS
  'Se true, la schermata Cucina mostra un task di preparazione per ogni riga ordine (fritti, bibite, dolci, ecc.).';

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
    prep_cucina,
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
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;
GRANT SELECT ON public."Prodotto" TO anon;

-- -----------------------------------------------------------------------------
-- Dipendenti: nome in sede (es. Â«AnnaÂ» alla cassa) per turni / riferimento umano
-- -----------------------------------------------------------------------------

ALTER TABLE public.utenti_ruoli
  ADD COLUMN IF NOT EXISTS nome_visualizzato TEXT;

COMMENT ON COLUMN public.utenti_ruoli.nome_visualizzato IS
  'Nome o etichetta del dipendente in sede (es. Anna), distinto dallâ€™account email; usabile per turni e report.';

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
  ur.nome_visualizzato,
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

-- =============================================================================
-- RLS core + public hardening (difesa in profondità; auth.uid + tenant)
-- =============================================================================
-- Dipendenze: public.utenti_ruoli, public.clienti, core.tenants; opzionale core.rider.
-- Rimuove policy legacy isolate_by_tenant (current_setting) dove presente.
-- Dopo deploy: rieseguire verify_database_inventory_readonly.sql (sez. 6–8) + smoke cross-tenant.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_core_tenant_access(p_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, core
AS $fn$
BEGIN
  IF p_tenant IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) IS NOT FALSE
      AND ur.tenant_id = p_tenant
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant
  ) THEN
    RETURN true;
  END IF;

  IF to_regclass('core.rider') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
        AND rr.tenant_id = p_tenant
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$fn$;

COMMENT ON FUNCTION public.pm_core_tenant_access(uuid) IS
  'RLS core: true se auth.uid() è superadmin, staff/cliente del tenant, o rider (core.rider.auth_user_id).';

REVOKE ALL ON FUNCTION public.pm_core_tenant_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_core_tenant_access(uuid) TO authenticated;

-- --- core.tenants (chiave = id) ------------------------------------------------
ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolate_by_tenant ON core.tenants;

DROP POLICY IF EXISTS pm_core_tenants_auth_tenant ON core.tenants;
CREATE POLICY pm_core_tenants_auth_tenant ON core.tenants
  FOR ALL
  TO authenticated
  USING (public.pm_core_tenant_access(id))
  WITH CHECK (public.pm_core_tenant_access(id));

-- --- core.prodotti: staff tenant + lettura anon menu (vista pubblica) ---------
ALTER TABLE core.prodotti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolate_by_tenant ON core.prodotti;

DROP POLICY IF EXISTS pm_core_prodotti_auth_tenant ON core.prodotti;
CREATE POLICY pm_core_prodotti_auth_tenant ON core.prodotti
  FOR ALL
  TO authenticated
  USING (public.pm_core_tenant_access(tenant_id))
  WITH CHECK (public.pm_core_tenant_access(tenant_id));

DROP POLICY IF EXISTS anon_select_prodotti_menu_pubblico ON core.prodotti;
CREATE POLICY anon_select_prodotti_menu_pubblico ON core.prodotti
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (attivo = true OR attivo IS NULL)
    AND (visibile_online = true OR visibile_online IS NULL)
  );

-- --- Tutte le altre tabelle core con colonna tenant_id (idempotente) ----------
DO $$
DECLARE
  r record;
  pol text;
BEGIN
  FOR r IN
    SELECT c.oid, c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'core'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns col
        WHERE col.table_schema = 'core'
          AND col.table_name = c.relname
          AND col.column_name = 'tenant_id'
      )
      AND c.relname <> 'prodotti'
    ORDER BY c.relname
  LOOP
    pol := 'pm_core_' || replace(r.tname, '-', '_') || '_auth_tenant';

    EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY', r.tname);
    EXECUTE format('DROP POLICY IF EXISTS isolate_by_tenant ON core.%I', r.tname);
    EXECUTE format('DROP POLICY IF EXISTS %I ON core.%I', pol, r.tname);
    EXECUTE format(
      'CREATE POLICY %I ON core.%I FOR ALL TO authenticated USING (public.pm_core_tenant_access(tenant_id)) WITH CHECK (public.pm_core_tenant_access(tenant_id))',
      pol,
      r.tname
    );
  END LOOP;
END $$;

-- --- core.consegna_percorso_ordine (tenant via percorso) -----------------------
DO $$
BEGIN
  IF to_regclass('core.consegna_percorso_ordine') IS NULL
     OR to_regclass('core.consegna_percorso') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE core.consegna_percorso_ordine ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS pm_core_consegna_percorso_ordine_auth ON core.consegna_percorso_ordine;
  CREATE POLICY pm_core_consegna_percorso_ordine_auth ON core.consegna_percorso_ordine
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM core.consegna_percorso cp
        WHERE cp.id = consegna_percorso_ordine.percorso_id
          AND public.pm_core_tenant_access(cp.tenant_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM core.consegna_percorso cp
        WHERE cp.id = consegna_percorso_ordine.percorso_id
          AND public.pm_core_tenant_access(cp.tenant_id)
      )
    );
END $$;

-- --- core.rider_posizione (tenant via rider) ----------------------------------
DO $$
BEGIN
  IF to_regclass('core.rider_posizione') IS NULL OR to_regclass('core.rider') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE core.rider_posizione ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS pm_core_rider_posizione_auth ON core.rider_posizione;
  CREATE POLICY pm_core_rider_posizione_auth ON core.rider_posizione
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM core.rider rr
        WHERE rr.id = rider_posizione.rider_id
          AND public.pm_core_tenant_access(rr.tenant_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM core.rider rr
        WHERE rr.id = rider_posizione.rider_id
          AND public.pm_core_tenant_access(rr.tenant_id)
      )
    );
END $$;

-- --- public: tabelle legacy backup / migrazioni Prisma (no accesso client) ----
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename = '_prisma_migrations'
        OR tablename LIKE '%\_backup' ESCAPE '\'
        OR tablename LIKE '%\_backup\_%' ESCAPE '\'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

-- --- public.ingrediente_allergeni ---------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.ingrediente_allergeni') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ingrediente_allergeni'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE NOTICE 'public.ingrediente_allergeni senza tenant_id: salto RLS pm_public_ingrediente_allergeni_tenant.';
    RETURN;
  END IF;

  ALTER TABLE public.ingrediente_allergeni ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS pm_public_ingrediente_allergeni_tenant ON public.ingrediente_allergeni;
  CREATE POLICY pm_public_ingrediente_allergeni_tenant ON public.ingrediente_allergeni
    FOR ALL
    TO authenticated
    USING (public.pm_core_tenant_access(tenant_id))
    WITH CHECK (public.pm_core_tenant_access(tenant_id));
END $$;

-- --- admin.* : policy esplicite se RLS attivo senza righe in pg_policies --------
-- Nota: in Dashboard Supabase non esporre lo schema admin a PostgREST. Se fosse esposto,
-- senza policy il ruolo authenticated non vedrebbe righe (comportamento sicuro ma opaco).
DO $$
DECLARE
  r record;
  pol text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'admin') THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'admin'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'admin' AND tablename = r.tname
    ) THEN
      CONTINUE;
    END IF;

    pol := 'pm_admin_' || replace(r.tname, '-', '_') || '_superadmin';

    EXECUTE format($f$
      CREATE POLICY %I ON admin.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
      )
    $f$, pol, r.tname);
  END LOOP;
END $$;
