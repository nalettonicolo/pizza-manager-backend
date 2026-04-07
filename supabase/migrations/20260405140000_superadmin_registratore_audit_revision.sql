-- Registratore Super Admin: revisione monotona (multi-scheda, ultima scrittura vince al save)
-- + audit append-only (nessun UPDATE/DELETE da client).

-- 1) Colonna revision (idempotente su DB già migrati senza colonna)
ALTER TABLE public.superadmin_registratore_state
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

-- 2) Trigger: updated_at + revision gestiti solo lato server (ignora valori client)
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

-- 3) Audit append-only
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

-- Nessuna policy INSERT/UPDATE/DELETE per authenticated: solo trigger (SECURITY DEFINER).

GRANT SELECT ON public.superadmin_registratore_audit TO authenticated;

-- 4) Trigger audit (dopo commit logica stato)
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
