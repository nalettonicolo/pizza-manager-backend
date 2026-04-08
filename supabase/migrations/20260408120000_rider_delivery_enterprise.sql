-- Rider / consegne enterprise — copia allineata a sql/modules/11_rider_delivery_enterprise.sql
-- Modifiche: editare il modulo 11 e riallineare questo file.

-- =============================================================================
-- 11) Rider / consegne enterprise — anagrafica rider, turni, percorsi, eventi
-- =============================================================================
-- Regola A (logistica): il flag bloccato_cucina su consegna_percorso_ordine indica
-- ordini non riordinabili al ricalcolo percorso (es. già in forno).
--
-- Dipendenze: core.tenants, core.ordini, core.punti_vendita (opzionale), core.users (opzionale)
-- Prerequisiti progetto: sql/modules/03_ordini_extensions.sql (tipo_ordine, stato_consegna, coordinate, …)
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
