-- =============================================================================
-- 27) Security advisors: security_invoker views + no auth.users in public view
-- =============================================================================
-- Fix:
--  - CRITICAL Security Definer View su viste public esposte a PostgREST
--  - CRITICAL Exposed Auth Users su public.ruoli_pizzeria (JOIN auth.users)
-- Ref: https://supabase.com/docs/guides/database/database-advisors
-- =============================================================================

-- Email staff solo se stesso tenant (o superadmin). Non espone auth.users via view.
CREATE OR REPLACE FUNCTION public.pm_staff_email_for_viewer(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email::text
  FROM auth.users u
  WHERE u.id = p_user_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.utenti_ruoli me
        JOIN public.utenti_ruoli target
          ON target.user_id = p_user_id
         AND target.tenant_id = me.tenant_id
        WHERE me.user_id = auth.uid()
          AND COALESCE(me.attivo, true) = true
          AND COALESCE(target.attivo, true) = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.utenti_ruoli sa
        WHERE sa.user_id = auth.uid()
          AND COALESCE(sa.attivo, true) = true
          AND lower(trim(COALESCE(sa.ruolo, ''))) IN ('superadmin', 'super_admin')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.pm_staff_email_for_viewer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_staff_email_for_viewer(UUID) TO authenticated;

COMMENT ON FUNCTION public.pm_staff_email_for_viewer(UUID) IS
  'Email auth.users solo per colleghi stesso tenant o superadmin (evita view su auth.users).';

-- Vista ruoli senza JOIN diretto a auth.users
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria
WITH (security_invoker = on)
AS
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
  public.pm_staff_email_for_viewer(ur.user_id) AS email
FROM public.utenti_ruoli ur
WHERE ur.tenant_id IN (
  SELECT ur2.tenant_id
  FROM public.utenti_ruoli ur2
  WHERE ur2.user_id = auth.uid()
)
OR EXISTS (
  SELECT 1
  FROM public.utenti_ruoli ur_sa
  WHERE ur_sa.user_id = auth.uid()
    AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
    AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;

-- Privilegi base necessari con security_invoker (view → tabelle core)
GRANT SELECT ON TABLE core.prodotto_ingrediente TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.prodotto_ingrediente TO authenticated;

-- Tutte le viste segnalate: esegui come invoker (rispetta RLS / privilegi caller)
DO $fix$
DECLARE
  v TEXT;
  views TEXT[] := ARRAY[
    'Ordine',
    'Prodotto',
    'punti_vendita',
    'prodotto_ingrediente',
    'categorie',
    'Categoria',
    'allergeni',
    'Allergene',
    'impasti',
    'ruoli_pizzeria'
  ];
BEGIN
  FOREACH v IN ARRAY views
  LOOP
    IF to_regclass(format('public.%I', v)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
    END IF;
  END LOOP;
END
$fix$;

COMMENT ON VIEW public.ruoli_pizzeria IS
  'Staff tenant + email via pm_staff_email_for_viewer; security_invoker=on.';
