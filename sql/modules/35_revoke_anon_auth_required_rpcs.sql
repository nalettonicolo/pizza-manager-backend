-- =============================================================================
-- 35) REVOKE anon su RPC che richiedono auth.uid() (grant superfluo)
-- =============================================================================
-- create_order_with_items (e simili) falliscono già se auth.uid() IS NULL,
-- ma restano eseguibili da anon a livello GRANT → advisor 0028.
-- =============================================================================

DO $$
DECLARE
  v_name text;
  v_names text[] := ARRAY[
    'create_order_with_items',
    'replace_order_items',
    'assert_web_cliente_antifraud',
    'assert_slot_capacity_for_ordine',
    'enqueue_nuovo_ordine_web_notifica',
    'chiudi_giornata',
    'cassa_audit_log',
    'delivery_mark_consegnato',
    'delivery_mark_consegnato_with_proof',
    'delivery_update_stato_consegna',
    'turni_cassa_aperto',
    'turni_cassa_apri',
    'turni_cassa_chiudi',
    'tenant_online_payment_setup_status',
    'tenant_payment_stripe_configured',
    'tenant_stripe_webhook_configured',
    'stripe_refund_allowed',
    'fiscal_outbox_export_pending_json',
    'staff_list_notifiche_outbox',
    'staff_retry_notifiche_outbox',
    'cliente_aggiorna_proprio_profilo',
    'cliente_dettaglio_proprio_ordine',
    'cliente_get_fidelity_profile',
    'cliente_lista_propri_ordini',
    'upsert_support_presence',
    'pm_staff_email_for_viewer'
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
