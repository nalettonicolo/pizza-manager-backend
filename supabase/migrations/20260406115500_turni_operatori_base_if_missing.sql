-- Base tabella turni cassa (se il dump remote_schema non è mai stato applicato).
-- Eseguire prima di 20260406120000_cassa_turni_rpc.sql.

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

-- FK opzionali (solo se le tabelle referenziate esistono)
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

-- FK verso punti_vendita solo se è tabella base (relkind 'r'): su alcuni DB è una VIEW → niente FK.
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
