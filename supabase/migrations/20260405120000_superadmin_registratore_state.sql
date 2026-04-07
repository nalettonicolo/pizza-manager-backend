-- Registratore cassa Super Admin — stato persistente (JSON) per utente, RLS solo superadmin.
-- Esegui dopo public.utenti_ruoli (ruolo superadmin).

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
