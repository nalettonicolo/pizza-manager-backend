-- Modulo 144 — Fix: pm_agente_quota_richieste/pm_agente_quota_superata senza controllo tenant
--
-- Le due funzioni sono SECURITY DEFINER, GRANT a authenticated, e leggono admin.tenants /
-- agente_utilizzo_mensile per il p_tenant_id passato dal client senza mai verificare che il
-- chiamante appartenga a quel tenant — IDOR a basso impatto (nessun dato personale/finanziario,
-- solo la quota AI configurata e se è già superata per il mese) ma comunque un controllo mancante
-- da chiudere. Stesso pattern usato altrove: utenti_ruoli attivo, o superadmin.
--
-- L'Edge Function agente-chat chiama entrambe con la service_role key (nessuna sessione utente,
-- auth.uid() è NULL) per il proprio controllo quota interno: auth.role() = 'service_role' resta
-- sempre autorizzato, altrimenti si romperebbe il controllo anti-costo-scoperto della modalità
-- 'cliente'.

CREATE OR REPLACE FUNCTION public.pm_agente_quota_richieste(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'core', 'admin'
AS $function$
DECLARE
  v_allowed boolean;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.role() = 'service_role' THEN
    v_allowed := true;
  ELSIF auth.uid() IS NULL THEN
    v_allowed := false;
  ELSE
    SELECT COALESCE(
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = p_tenant_id
          AND COALESCE(ur.attivo, true) = true
      ) OR public.pm_auth_is_superadmin(),
      false
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT greatest(1, coalesce((t.parametri_operativi->>'agente_quota_richieste_mese')::int, 400))
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm_agente_quota_superata(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'core', 'admin'
AS $function$
DECLARE
  v_allowed boolean;
  v_quota integer;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF auth.role() = 'service_role' THEN
    v_allowed := true;
  ELSIF auth.uid() IS NULL THEN
    v_allowed := false;
  ELSE
    SELECT COALESCE(
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = p_tenant_id
          AND COALESCE(ur.attivo, true) = true
      ) OR public.pm_auth_is_superadmin(),
      false
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RETURN false;
  END IF;

  v_quota := public.pm_agente_quota_richieste(p_tenant_id);

  RETURN COALESCE(
    (
      SELECT u.richieste_count >= v_quota
      FROM public.agente_utilizzo_mensile u
      WHERE u.tenant_id = p_tenant_id
        AND u.periodo = date_trunc('month', now())::date
    ),
    false
  );
END;
$function$;
