-- Nota password accesso dipendenti: solo tenant admin (tenant_admins), non leggibile dagli altri utenti.
-- Non è la password reale in auth.users: è un archivio opzionale che il titolare aggiorna quando crea/resetta l’accesso.

CREATE TABLE IF NOT EXISTS public.staff_password_note (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants (id) ON DELETE CASCADE,
  password_nota TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_password_note_tenant ON public.staff_password_note (tenant_id);

ALTER TABLE public.staff_password_note ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_password_note TO authenticated;

COMMENT ON TABLE public.staff_password_note IS 'Nota password accesso staff (solo admin tenant). Non sincronizzata con GoTrue; RLS: solo tenant_admins.';
