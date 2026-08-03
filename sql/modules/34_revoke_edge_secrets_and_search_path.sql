-- =============================================================================
-- 34) Hardening grants SECURITY DEFINER + search_path helper pm_*
-- =============================================================================
-- Advisor 0028/0029: molte RPC DEFINER restano eseguibili da anon/authenticated
-- perché Postgres concede EXECUTE a PUBLIC di default. Qui:
--   1) REVOKE mirato su edge/secrets/fiscal/trigger (solo service_role dove serve)
--   2) REVOKE anon su RPC admin sensibili (resta authenticated se previsto)
--   3) SET search_path sulle 4 pm_* segnalate (0011)
-- Idempotente. Nessun DROP.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: revoca EXECUTE da PUBLIC/anon/authenticated su tutte le overload
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pm_revoke_exec_client_roles(p_schema text, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid,
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = p_schema
      AND p.proname = p_name
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._pm_revoke_exec_client_roles(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._pm_revoke_exec_client_roles(text, text) FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- P0: solo service_role (Edge / worker)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
  v_names text[] := ARRAY[
    'get_stripe_secret_for_tenant_edge',
    'get_stripe_webhook_secret_for_tenant_edge',
    'get_tenant_id_by_stripe_payment_intent',
    'edge_get_ordine_payment_context',
    'edge_ordine_snapshot_for_stripe',
    'edge_stripe_append_refund',
    'edge_stripe_attach_payment_intent',
    'edge_stripe_mark_payment_failed',
    'edge_stripe_mark_payment_succeeded',
    'claim_fiscal_outbox_batch',
    'complete_fiscal_outbox_item'
  ];
  r RECORD;
BEGIN
  FOREACH v_name IN ARRAY v_names
  LOOP
    PERFORM public._pm_revoke_exec_client_roles('public', v_name);
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END LOOP;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Trigger / helper interni: non devono essere RPC PostgREST
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
  v_names text[] := ARRAY[
    'handle_new_auth_user',
    'sync_tenant_admins',
    'ordine_instead_of_update',
    'tg_superadmin_registratore_audit_aiu',
    'tg_superadmin_registratore_state_biu',
    'cottura_delete',
    'cottura_insert',
    'cottura_update',
    'formati_delete',
    'formati_insert',
    'formati_update',
    'ingredienti_delete',
    'ingredienti_insert',
    'ingredienti_update',
    'prodotto_ingrediente_delete',
    'prodotto_ingrediente_insert'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names
  LOOP
    PERFORM public._pm_revoke_exec_client_roles('public', v_name);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Admin / SA: mai anon; authenticated resta (assert interno obbligatorio)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
  v_names text[] := ARRAY[
    'aggiungi_ruolo_pizzeria',
    'save_tenant_stripe_secret',
    'save_tenant_stripe_webhook_secret',
    'sa_get_go_live_checklist',
    'sa_upsert_go_live_checklist',
    'sa_list_support_presence'
  ];
  r RECORD;
BEGIN
  FOREACH v_name IN ARRAY v_names
  LOOP
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END LOOP;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 0011: search_path sulle helper pm_* residue (non DEFINER)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'pm_touch_updated_at',
        'pm_point_in_ring',
        'pm_ordine_items_pizze_count',
        'pm_orario_ritiro_to_slot_key'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, core, pg_temp', r.sig);
  END LOOP;
END;
$$;

-- Helper di migrazione non esposto
REVOKE ALL ON FUNCTION public._pm_revoke_exec_client_roles(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._pm_revoke_exec_client_roles(text, text) FROM anon, authenticated;

COMMENT ON FUNCTION public._pm_revoke_exec_client_roles(text, text) IS
  'Utility hardening modulo 34: REVOKE EXECUTE client roles. Non usare da API.';
