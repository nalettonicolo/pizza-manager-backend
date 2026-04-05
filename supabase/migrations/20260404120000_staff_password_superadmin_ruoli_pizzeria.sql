-- Super Admin: lettura ruoli di qualsiasi tenant (vista ruoli_pizzeria) e gestione staff_password_note.
-- Il Super Admin è identificato da public.utenti_ruoli (ruolo = 'superadmin', attivo).

-- -----------------------------------------------------------------------------
-- 1) Vista ruoli_pizzeria: include tutte le righe se l'utente corrente è superadmin
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2) staff_password_note: tenant_admins oppure superadmin (qualsiasi tenant)
-- -----------------------------------------------------------------------------
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
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  );

COMMENT ON TABLE public.staff_password_note IS 'Nota password accesso staff (archivio titolare). RLS: tenant_admins del tenant o utente con ruolo superadmin in utenti_ruoli.';
