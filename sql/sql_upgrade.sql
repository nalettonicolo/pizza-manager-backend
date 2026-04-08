-- =============================================================================
-- PizzaManager — SQL UPGRADE (modifiche incrementali, copia-incolla o migration CLI)
-- =============================================================================
--
-- Moduli nominati in sql/modules/ e supabase/migrations/; il testo SQL completo
-- degli ultimi interventi è scritto sotto nello stesso file (nessun rinvio obbligatorio).
--
-- 2026-04-08 — Due blocchi SQL in coda al file (eseguire in ordine):
--   (1) schema rider / percorsi / outbox / colonne core.ordini / RLS
--       — allineato a 20260408120000 e 11_rider_delivery_enterprise.sql
--   (2) funzione + vista public."Ordine" + trigger
--       — allineato a 20260408121000 e 04_ordine_view_trigger.sql
-- Prerequisito: sql/modules/03_ordini_extensions.sql su core.ordini
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2026-04-05 — Registratore cassa Super Admin (sync enterprise su Supabase)
-- Copia anche in: supabase/migrations/20260405120000_superadmin_registratore_state.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.superadmin_registratore_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_registratore_state_user
  ON public.superadmin_registratore_state (user_id);

COMMENT ON TABLE public.superadmin_registratore_state IS
  'Stato registratore cassa standalone (Super Admin). Un blob JSON per utente; nessun tenant_id.';

ALTER TABLE public.superadmin_registratore_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_registratore_state_superadmin_all" ON public.superadmin_registratore_state;

CREATE POLICY "superadmin_registratore_state_superadmin_all"
  ON public.superadmin_registratore_state
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.ruolo)) = 'superadmin'
        AND (ur.attivo IS DISTINCT FROM false)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.ruolo)) = 'superadmin'
        AND (ur.attivo IS DISTINCT FROM false)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.superadmin_registratore_state TO authenticated;

-- -----------------------------------------------------------------------------
-- 2026-04-05 — Registratore Super Admin: revision + audit append-only
-- Copia anche in: supabase/migrations/20260405140000_superadmin_registratore_audit_revision.sql
-- -----------------------------------------------------------------------------

ALTER TABLE public.superadmin_registratore_state
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.tg_superadmin_registratore_state_biu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.revision := 1;
    RETURN NEW;
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'superadmin_registratore_state: user_id immutabile';
  END IF;
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_superadmin_registratore_state_biu ON public.superadmin_registratore_state;
CREATE TRIGGER tr_superadmin_registratore_state_biu
  BEFORE INSERT OR UPDATE ON public.superadmin_registratore_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_superadmin_registratore_state_biu();

CREATE TABLE IF NOT EXISTS public.superadmin_registratore_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  op text NOT NULL CHECK (op IN ('insert', 'update')),
  revision bigint NOT NULL,
  payload_before jsonb,
  payload_after jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_registratore_audit_user_created
  ON public.superadmin_registratore_audit (user_id, created_at DESC);

COMMENT ON TABLE public.superadmin_registratore_audit IS
  'Append-only: ogni salvataggio stato registratore. Nessun UPDATE/DELETE da ruolo authenticated.';

ALTER TABLE public.superadmin_registratore_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_registratore_audit_select_own" ON public.superadmin_registratore_audit;

CREATE POLICY "superadmin_registratore_audit_select_own"
  ON public.superadmin_registratore_audit
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.ruolo)) = 'superadmin'
        AND (ur.attivo IS DISTINCT FROM false)
    )
  );

GRANT SELECT ON public.superadmin_registratore_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_superadmin_registratore_audit_aiu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.superadmin_registratore_audit (user_id, op, revision, payload_before, payload_after)
    VALUES (NEW.user_id, 'insert', NEW.revision, NULL, NEW.payload);
    RETURN NEW;
  END IF;
  INSERT INTO public.superadmin_registratore_audit (user_id, op, revision, payload_before, payload_after)
  VALUES (NEW.user_id, 'update', NEW.revision, OLD.payload, NEW.payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_superadmin_registratore_audit_aiu ON public.superadmin_registratore_state;
CREATE TRIGGER tr_superadmin_registratore_audit_aiu
  AFTER INSERT OR UPDATE ON public.superadmin_registratore_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_superadmin_registratore_audit_aiu();

-- -----------------------------------------------------------------------------
-- 2026-04-06 — Tabella turni_operatori se manca (prima delle RPC cassa)
-- Copia anche in: supabase/migrations/20260406115500_turni_operatori_base_if_missing.sql
-- -----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.turni_operatori_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.turni_operatori_id_seq OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.turni_operatori (
  id integer NOT NULL DEFAULT nextval('public.turni_operatori_id_seq'::regclass),
  user_id uuid,
  tenant_id uuid NOT NULL,
  punto_vendita_id uuid,
  stato text NOT NULL DEFAULT 'aperto'::text,
  aperto_il timestamp with time zone DEFAULT now(),
  chiuso_il timestamp with time zone,
  azienda_id uuid,
  fondo_contato_euro numeric(12, 2),
  incasso_atteso_euro numeric(12, 2),
  delta_euro numeric(12, 2),
  note_chiusura text,
  CONSTRAINT turni_operatori_stato_check CHECK ((stato = ANY (ARRAY['aperto'::text, 'chiuso'::text])))
);

ALTER TABLE ONLY public.turni_operatori OWNER TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_pkey' AND conrelid = 'public.turni_operatori'::regclass
  ) THEN
    ALTER TABLE ONLY public.turni_operatori ADD CONSTRAINT turni_operatori_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER SEQUENCE public.turni_operatori_id_seq OWNED BY public.turni_operatori.id;

CREATE INDEX IF NOT EXISTS idx_turni_operatori_tenant_id ON public.turni_operatori USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_turni_user ON public.turni_operatori USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_turni_operatori_azienda ON public.turni_operatori USING btree (azienda_id);

CREATE UNIQUE INDEX IF NOT EXISTS unico_turno_aperto_per_operatore
  ON public.turni_operatori USING btree (user_id, tenant_id)
  WHERE ((stato = 'aperto'::text) AND (chiuso_il IS NULL));

DO $$
BEGIN
  IF to_regclass('core.tenants') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_tenant_id_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES core.tenants (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_user_id_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'punti_vendita'
      AND c.relkind = 'r'
  )
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_punto_vendita_id_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_punto_vendita_id_fkey
      FOREIGN KEY (punto_vendita_id) REFERENCES public.punti_vendita (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'aziende'
      AND c.relkind = 'r'
  )
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_azienda_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_azienda_fkey
      FOREIGN KEY (azienda_id) REFERENCES public.aziende (id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.turni_operatori ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.turni_operatori TO postgres;
GRANT ALL ON SEQUENCE public.turni_operatori_id_seq TO postgres;
GRANT ALL ON TABLE public.turni_operatori TO service_role;
GRANT ALL ON SEQUENCE public.turni_operatori_id_seq TO service_role;

-- -----------------------------------------------------------------------------
-- 2026-04-06 — Turni cassa RPC + colonne riconciliazione
-- Copia anche in: supabase/migrations/20260406120000_cassa_turni_rpc.sql
-- -----------------------------------------------------------------------------

ALTER TABLE public.turni_operatori
  ADD COLUMN IF NOT EXISTS fondo_contato_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS incasso_atteso_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS delta_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS note_chiusura text;

CREATE OR REPLACE FUNCTION public._turni_cassa_assert_staff(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND (ur.attivo IS DISTINCT FROM false)
  ) THEN
    RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_aperto(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  SELECT jsonb_build_object(
    'id', t.id,
    'punto_vendita_id', t.punto_vendita_id,
    'stato', t.stato,
    'aperto_il', t.aperto_il,
    'chiuso_il', t.chiuso_il,
    'fondo_contato_euro', t.fondo_contato_euro,
    'incasso_atteso_euro', t.incasso_atteso_euro,
    'delta_euro', t.delta_euro,
    'note_chiusura', t.note_chiusura
  )
  INTO r
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT 1;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_apri(p_tenant_id uuid, p_punto_vendita_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  existing_pv uuid;
  v_new_id integer;
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  IF p_punto_vendita_id IS NULL THEN
    RAISE EXCEPTION 'punto_vendita_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.punti_vendita pv
    WHERE pv.id = p_punto_vendita_id
      AND pv.tenant_id = p_tenant_id
      AND pv.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'punto_vendita_non_valido' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.punto_vendita_id
  INTO existing_pv
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  LIMIT 1;

  IF FOUND THEN
    IF existing_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_aperto_altro_pv' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
      'id', t.id,
      'punto_vendita_id', t.punto_vendita_id,
      'stato', t.stato,
      'aperto_il', t.aperto_il,
      'chiuso_il', t.chiuso_il,
      'gia_aperto', true
    )
    INTO r
    FROM public.turni_operatori t
    WHERE t.user_id = auth.uid()
      AND t.tenant_id = p_tenant_id
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL
    LIMIT 1;

    RETURN r;
  END IF;

  INSERT INTO public.turni_operatori (user_id, tenant_id, punto_vendita_id, stato, aperto_il)
  VALUES (auth.uid(), p_tenant_id, p_punto_vendita_id, 'aperto', now())
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'id', t.id,
    'punto_vendita_id', t.punto_vendita_id,
    'stato', t.stato,
    'aperto_il', t.aperto_il,
    'chiuso_il', t.chiuso_il,
    'gia_aperto', false
  )
  INTO r
  FROM public.turni_operatori t
  WHERE t.id = v_new_id;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_chiudi(
  p_tenant_id uuid,
  p_fondo_contato_euro numeric,
  p_incasso_atteso_euro numeric DEFAULT NULL,
  p_note_chiusura text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_delta numeric(12, 2);
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  IF p_fondo_contato_euro IS NULL THEN
    RAISE EXCEPTION 'fondo_contato_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id
  INTO v_id
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'nessun_turno_aperto' USING ERRCODE = 'P0001';
  END IF;

  v_delta := CASE
    WHEN p_incasso_atteso_euro IS NULL THEN NULL
    ELSE round(p_fondo_contato_euro - p_incasso_atteso_euro, 2)
  END;

  UPDATE public.turni_operatori t
  SET
    stato = 'chiuso',
    chiuso_il = now(),
    fondo_contato_euro = p_fondo_contato_euro,
    incasso_atteso_euro = p_incasso_atteso_euro,
    delta_euro = v_delta,
    note_chiusura = NULLIF(trim(p_note_chiusura), '')
  WHERE t.id = v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'chiuso', true,
    'fondo_contato_euro', p_fondo_contato_euro,
    'incasso_atteso_euro', p_incasso_atteso_euro,
    'delta_euro', v_delta
  );
END;
$$;

ALTER FUNCTION public._turni_cassa_assert_staff(uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_aperto(uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_apri(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public._turni_cassa_assert_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_aperto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_apri(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.turni_cassa_aperto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turni_cassa_apri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2026-04-06 — core.ordini.turno_operatori_id + create_order_with_items(..., p_turno_operatori_id)
-- Script completo (colonna, FK opzionale, RPC, vista public."Ordine"):
--   supabase/migrations/20260406140000_ordine_turno_operatori.sql
-- Moduli sorgente: sql/modules/03_ordini_extensions.sql, 04_ordine_view_trigger.sql, 05_pm_point_create_order.sql
-- -----------------------------------------------------------------------------
-- 2026-04-06 — Audit cassa append-only + RPC public.cassa_audit_log
--   supabase/migrations/20260406150000_cassa_ordine_audit.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- (1) schema rider / percorsi / outbox / colonne core.ordini / RLS
-- Allineato a: supabase/migrations/20260408120000_rider_delivery_enterprise.sql
--              sql/modules/11_rider_delivery_enterprise.sql
-- =============================================================================

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

-- =============================================================================
-- (2) funzione + vista public."Ordine" + trigger
-- Allineato a: supabase/migrations/20260408121000_ordine_view_rider_columns.sql
--              sql/modules/04_ordine_view_trigger.sql
-- =============================================================================

-- =============================================================================
-- 4) Vista public."Ordine" + INSTEAD OF UPDATE
-- =============================================================================

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
    nome_cliente       = NEW.nome_cliente,
    orario_ritiro      = NEW.orario_ritiro,
    indirizzo_consegna = NEW.indirizzo_consegna,
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
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();

-- ---------------------------------------------------------------------------
-- Menu pubblico anon: RLS su core.prodotti (20260408140000_prodotti_menu_pubblico_anon_rls)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS prodotti_public_menu_anon_select ON core.prodotti;

CREATE POLICY prodotti_public_menu_anon_select
  ON core.prodotti
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (attivo IS NULL OR attivo = true)
    AND (visibile_online IS NULL OR visibile_online = true)
  );
