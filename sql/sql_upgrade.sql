-- =============================================================================
-- PizzaManager — SQL UPGRADE (nuove implementazioni incrementali)
-- =============================================================================
--
-- Stato:
-- - Le patch della Fase 0 (2026-04-18) sono consolidate in:
--   sql/schema_completo_pizzamanager.sql (coda: CONSOLIDAMENTO FASE 0)
-- - Questo file deve contenere SOLO nuove modifiche non ancora consolidate.
--
-- Regole operative:
-- 1) Aggiungere qui solo patch incrementali idempotenti.
-- 2) Dopo applicazione e verifica su Supabase/staging, consolidare in schema_completo.
-- 3) Poi svuotare di nuovo questo file mantenendo il template.
--
-- Template blocco patch:
-- -----------------------------------------------------------------------------
-- -- YYYY-MM-DD - titolo breve
-- DO $$
-- BEGIN
--   -- SQL idempotente
-- END $$;
-- -----------------------------------------------------------------------------

-- 2026-04-18 — delivery_mark_consegnato: allinea autorizzazione a permessi app (superadmin, ruoli admin IT, account test 4 reparti)
-- 2026-04-18b — superadmin: controllo inline su public.profiles (evita errore se public.is_superadmin() non è mai stato deployato)
CREATE OR REPLACE FUNCTION public.delivery_mark_consegnato(
  p_ordine_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id
  INTO v_tenant_id
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = v_tenant_id
          AND COALESCE(ur.attivo, true) = true
          AND (
            lower(trim(COALESCE(ur.ruolo, ''))) IN (
              'delivery', 'pony', 'cassa', 'admin', 'amministratore', 'gestore'
            )
            OR COALESCE(ur.accesso_delivery, false) = true
            OR COALESCE(ur.accesso_pony, false) = true
            OR COALESCE(ur.accesso_cassa, false) = true
          )
      )
    ),
    false
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo = 'superadmin'
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.utenti_ruoli ur
      ON ur.user_id = u.id
     AND ur.tenant_id = v_tenant_id
     AND COALESCE(ur.attivo, true) = true
    WHERE u.id = auth.uid()
      AND lower(trim(COALESCE(u.email, ''))) = 'pizzaioli@pizzamanager.it'
  )
  INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = 'CONSEGNATO',
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_delivery = 'CONSEGNATO'::core.stato_delivery,
    consegna_effettiva_at = COALESCE(o.consegna_effettiva_at, now()),
    updated_at = now()
  WHERE o.id = p_ordine_id
    AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (v_tenant_id, p_ordine_id, 'delivery_mark_consegnato', '{}'::jsonb, auth.uid());
  END IF;
END;
$$;

COMMENT ON FUNCTION public.delivery_mark_consegnato(UUID) IS
  'Segna ordine CONSEGNATO (atomico). Consentito: ruoli delivery/pony/cassa/admin/amministratore/gestore, flag accesso_delivery/pony/cassa, superadmin piattaforma, account test pizzaioli@pizzamanager.it sul tenant.';

GRANT EXECUTE ON FUNCTION public.delivery_mark_consegnato(UUID) TO authenticated;
