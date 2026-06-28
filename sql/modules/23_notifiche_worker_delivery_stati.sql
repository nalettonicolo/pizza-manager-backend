-- Fase 4/5 gap: worker notifiche_outbox, stati delivery atomici, fidelity match email.

-- Stato intermedio per claim worker (idempotente)
DO $$
BEGIN
  IF to_regclass('public.notifiche_outbox') IS NOT NULL THEN
    ALTER TABLE public.notifiche_outbox DROP CONSTRAINT IF EXISTS notifiche_outbox_stato_check;
    ALTER TABLE public.notifiche_outbox ADD CONSTRAINT notifiche_outbox_stato_check
      CHECK (stato IN ('in_coda', 'in_elaborazione', 'inviato', 'fallito', 'annullato'));
  END IF;
END $$;

-- --- Notifiche outbox worker (Edge / cron, service_role) -----------------------
CREATE OR REPLACE FUNCTION public.claim_notifiche_outbox_batch(p_limit INTEGER DEFAULT 30)
RETURNS SETOF public.notifiche_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notifiche_outbox n
  SET
    tentativi = n.tentativi + 1,
    stato = 'in_elaborazione'
  WHERE n.id IN (
    SELECT x.id
    FROM public.notifiche_outbox x
    WHERE x.stato IN ('in_coda', 'fallito')
      AND x.tentativi < 8
    ORDER BY x.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING n.*;
END;
$$;

COMMENT ON FUNCTION public.claim_notifiche_outbox_batch(INTEGER) IS
  'Claim batch notifiche in_coda per worker Edge (service_role).';

REVOKE ALL ON FUNCTION public.claim_notifiche_outbox_batch(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notifiche_outbox_batch(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_notifiche_outbox_item(
  p_id UUID,
  p_stato TEXT,
  p_ultimo_errore TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NULL THEN RETURN; END IF;
  UPDATE public.notifiche_outbox
  SET
    stato = COALESCE(NULLIF(trim(p_stato), ''), stato),
    ultimo_errore = p_ultimo_errore,
    inviato_at = CASE WHEN lower(trim(COALESCE(p_stato, ''))) = 'inviato' THEN now() ELSE inviato_at END
  WHERE id = p_id;

  -- Retry automatico: fallito torna in coda se tentativi < 8
  IF lower(trim(COALESCE(p_stato, ''))) = 'fallito' THEN
    UPDATE public.notifiche_outbox
    SET stato = 'in_coda'
    WHERE id = p_id AND tentativi < 8;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.complete_notifiche_outbox_item(UUID, TEXT, TEXT) IS
  'Completa item notifiche_outbox (inviato / fallito / annullato).';

REVOKE ALL ON FUNCTION public.complete_notifiche_outbox_item(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_notifiche_outbox_item(UUID, TEXT, TEXT) TO service_role;

-- --- Delivery: transizioni stato_consegna + stato_delivery -------------------
CREATE OR REPLACE FUNCTION public.delivery_update_stato_consegna(
  p_ordine_id UUID,
  p_stato TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
  v_stato TEXT := upper(trim(COALESCE(p_stato, '')));
  v_delivery core.stato_delivery;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;
  IF v_stato NOT IN ('ASSEGNATO', 'IN_VIAGGIO', 'RICHIESTA', 'PROBLEMA') THEN
    RAISE EXCEPTION 'stato_non_valido';
  END IF;

  SELECT o.tenant_id INTO v_tenant_id FROM core.ordini o WHERE o.id = p_ordine_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
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
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'superadmin')
  OR EXISTS (
    SELECT 1 FROM auth.users u
    INNER JOIN public.utenti_ruoli ur ON ur.user_id = u.id AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
    WHERE u.id = auth.uid()
      AND lower(trim(COALESCE(u.email, ''))) = 'pizzaioli@pizzamanager.it'
  )
  INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  v_delivery := CASE v_stato
    WHEN 'ASSEGNATO' THEN 'ASSEGNATO'::core.stato_delivery
    WHEN 'IN_VIAGGIO' THEN 'IN_VIAGGIO'::core.stato_delivery
    WHEN 'RICHIESTA' THEN 'DA_ASSEGNARE'::core.stato_delivery
    WHEN 'PROBLEMA' THEN 'ANOMALIA'::core.stato_delivery
    ELSE 'DA_ASSEGNARE'::core.stato_delivery
  END;

  UPDATE core.ordini o
  SET
    stato_consegna = v_stato,
    stato_delivery = v_delivery,
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (
      v_tenant_id,
      p_ordine_id,
      'delivery_update_stato',
      jsonb_build_object('stato_consegna', v_stato, 'stato_delivery', v_delivery::text),
      auth.uid()
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.delivery_update_stato_consegna(UUID, TEXT) IS
  'Aggiorna stato_consegna + stato_delivery (ASSEGNATO, IN_VIAGGIO, RICHIESTA, PROBLEMA).';

REVOKE ALL ON FUNCTION public.delivery_update_stato_consegna(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_update_stato_consegna(UUID, TEXT) TO authenticated;

-- --- Fidelity cliente: match anche per email anagrafica -----------------------
CREATE OR REPLACE FUNCTION public.cliente_get_fidelity_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente public.clienti%ROWTYPE;
  v_anagrafica_id uuid;
  v_saldo public.fidelity_saldi%ROWTYPE;
  v_movimenti jsonb;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cliente FROM public.clienti WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('attivo', false, 'motivo', 'profilo_cliente_assente');
  END IF;

  v_email := trim(lower(COALESCE(v_cliente.email, '')));

  SELECT ac.id INTO v_anagrafica_id
  FROM public.anagrafica_clienti ac
  WHERE ac.tenant_id = v_cliente.tenant_id
    AND (
      (
        trim(lower(ac.nome)) = trim(lower(COALESCE(v_cliente.nome, '')))
        AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(COALESCE(v_cliente.indirizzo, '')))
        AND trim(COALESCE(ac.telefono, '')) = trim(COALESCE(v_cliente.telefono, ''))
      )
      OR (
        v_email <> ''
        AND trim(lower(COALESCE(ac.email, ''))) = v_email
      )
    )
  ORDER BY
    CASE WHEN v_email <> '' AND trim(lower(COALESCE(ac.email, ''))) = v_email THEN 0 ELSE 1 END,
    ac.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_anagrafica_id IS NULL THEN
    RETURN jsonb_build_object('attivo', false, 'motivo', 'anagrafica_non_collegata');
  END IF;

  SELECT * INTO v_saldo
  FROM public.fidelity_saldi fs
  WHERE fs.tenant_id = v_cliente.tenant_id AND fs.anagrafica_cliente_id = v_anagrafica_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('punti', fm.punti, 'tipo', fm.tipo, 'note', fm.note, 'created_at', fm.created_at)
      ORDER BY fm.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_movimenti
  FROM (
    SELECT fm.punti, fm.tipo, fm.note, fm.created_at
    FROM public.fidelity_movimenti fm
    WHERE fm.tenant_id = v_cliente.tenant_id AND fm.anagrafica_cliente_id = v_anagrafica_id
    ORDER BY fm.created_at DESC
    LIMIT 20
  ) fm;

  RETURN jsonb_build_object(
    'attivo', true,
    'punti', COALESCE(v_saldo.punti, 0),
    'codice_carta', v_saldo.codice_carta,
    'nome_negozio', v_saldo.nome_negozio,
    'movimenti', v_movimenti
  );
END;
$$;

-- Staff: lista notifiche outbox tenant
CREATE OR REPLACE FUNCTION public.staff_list_notifiche_outbox(
  p_tenant_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'non_autenticato'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = p_tenant_id AND COALESCE(ur.attivo, true) = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(n)::jsonb ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT id, tipo, destinatario, stato, tentativi, ultimo_errore, payload, created_at, inviato_at
    FROM public.notifiche_outbox
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200))
  ) n;

  RETURN jsonb_build_object('items', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_notifiche_outbox(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_notifiche_outbox(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_retry_notifiche_outbox(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF p_id IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT tenant_id INTO v_tenant_id FROM public.notifiche_outbox WHERE id = p_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = v_tenant_id AND COALESCE(ur.attivo, true) = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.notifiche_outbox
  SET stato = 'in_coda', ultimo_errore = NULL, tentativi = 0
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_retry_notifiche_outbox(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_retry_notifiche_outbox(UUID) TO authenticated;
