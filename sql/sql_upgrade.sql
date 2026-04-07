-- =============================================================================
-- PizzaManager — SQL UPGRADE (solo modifiche da qui in avanti)
-- =============================================================================
--
-- Lo storico degli script manuali è stato suddiviso in moduli riutilizzabili:
--   sql/modules/01_fidelity_tenant.sql … 10_punti_vendita_lat_lng_view.sql
-- Esegui i moduli IN ORDINE su un database nuovo o se mancano oggetti elencati
-- nel README della cartella modules.
--
-- Questo file serve per:
--   • Nuove migration incrementali (copia-incolla in Supabase SQL Editor dopo review)
--   • Oppure: aggiungi un file in supabase/migrations/YYYYMMDDHHMMSS_nome.sql per CLI
--
-- (Nessuna istruzione DDL obbligatoria qui finché non serve una modifica nuova.)
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
-- -----------------------------------------------------------------------------
-- 2026-04-06 — Audit cassa append-only + RPC public.cassa_audit_log
--   supabase/migrations/20260406150000_cassa_ordine_audit.sql
-- -----------------------------------------------------------------------------
