-- Modulo 139 — Batch fix di sicurezza (audit OWASP 2026-08-30)
--
-- Punti sistemati in questo modulo (vedi Registro Attività per il dettaglio dell'audit):
-- 1) attrezzature_catalogo.costo_acquisto: non più leggibile da clienti/staff dei tenant.
-- 2) enqueue_nuovo_ordine_web_notifica: non più chiamabile in modo anonimo bypassando il
--    controllo di appartenenza tenant.
-- 3) chiudi_giornata / chiudi_ordini_aperti_fino_a: ristretti a ruoli cassa/admin (+ superadmin),
--    non più a QUALSIASI riga attiva in utenti_ruoli (es. un account pony/delivery).
-- 4) staff_password_note: la lettura in blocco (Admin -> Ruoli -> Archivio password) passa ora
--    dalla stessa RPC gia' usata per la lettura singola (admin_richiedi_password_nota, con
--    verifica password server-side + audit), non piu' da una select diretta senza controllo.
-- 5) Rimosso il bypass hardcoded sull'email 'pizzaioli@pizzamanager.it' in
--    delivery_update_stato_consegna (introdotto qui stesso nel modulo 137): un account con
--    quell'email deve avere un ruolo operativo vero, non un'eccezione nel codice.
-- 6) Bucket storage tenant-logos: rimossa la policy che permetteva il listing pubblico di tutti
--    i file (le immagini restano leggibili via URL pubblico del bucket, non serve la policy SELECT
--    su storage.objects per quello).
-- 7) pm_storage_path_tenant_id: search_path fissato esplicitamente (era mutabile).
-- 8) rider_ensure_me: richiede un ruolo operativo vero sul tenant (delivery/pony/staff), non
--    più "qualunque utente autenticato" — prima chiunque poteva crearsi una riga rider su un
--    tenant a cui non apparteneva.

-- 1) attrezzature_catalogo: costo_acquisto (margine interno) e prezzo_acquisto erano leggibili
--    da QUALSIASI utente autenticato (policy "disponibile = true" senza controllo di ruolo).
--    I privilegi Postgres sono per-colonna solo a livello di ruolo DB, non per-riga: dato che
--    tenant e superadmin condividono lo stesso ruolo "authenticated", non si può restringere una
--    colonna solo ai tenant lasciandola al superadmin con un semplice GRANT di colonna. La vera
--    esposizione è che questa policy pubblica non serve a nulla oggi: nessuna schermata
--    tenant-facing legge questa tabella (solo CatalogoHardwareManager.jsx lato superadmin, già
--    coperto dalla policy ALL superadmin sotto). La rimuoviamo: resta leggibile solo al
--    superadmin, come da intento del commento originale del modulo 111 ("mai esposto ai tenant").
DROP POLICY IF EXISTS attrezzature_catalogo_tenant_select ON public.attrezzature_catalogo;

-- 2) enqueue_nuovo_ordine_web_notifica: richiede sempre un chiamante autenticato e verificato sul
--    tenant — prima il controllo veniva saltato del tutto per auth.uid() NULL (chiamate anonime).
CREATE OR REPLACE FUNCTION public.enqueue_nuovo_ordine_web_notifica(p_tenant_id uuid, p_ordine_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'admin'
AS $function$
DECLARE
  v_dest TEXT;
  v_canale TEXT;
  v_po JSONB;
  v_tel_sms TEXT;
  v_tel_wa TEXT;
  v_email_override TEXT;
BEGIN
  IF p_tenant_id IS NULL OR p_ordine_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.tenant_id = p_tenant_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'superadmin'
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF to_regclass('public.notifiche_outbox') IS NULL THEN
    RETURN;
  END IF;

  SELECT t.parametri_operativi
  INTO v_po
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  v_canale := lower(trim(COALESCE(v_po->>'notifica_ordine_web_canale', 'email')));
  IF v_canale NOT IN ('email', 'sms', 'whatsapp', 'in_app') THEN
    v_canale := 'email';
  END IF;

  v_tel_sms := NULLIF(trim(COALESCE(v_po->>'notifica_ordine_web_telefono_sms', '')), '');
  v_tel_wa := NULLIF(trim(COALESCE(v_po->>'notifica_ordine_web_telefono_whatsapp', '')), '');
  v_email_override := NULLIF(trim(COALESCE(v_po->>'notifica_ordine_web_email', '')), '');

  SELECT COALESCE(
    v_email_override,
    NULLIF(trim(t.email_fatturazione), ''),
    NULLIF(trim(t.pec), ''),
    'staff@tenant'
  )
  INTO v_dest
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  IF v_canale = 'sms' AND v_tel_sms IS NOT NULL THEN
    v_dest := v_tel_sms;
  ELSIF v_canale = 'whatsapp' AND v_tel_wa IS NOT NULL THEN
    v_dest := v_tel_wa;
  ELSIF v_canale = 'in_app' THEN
    v_dest := 'operative_dashboard';
  END IF;

  INSERT INTO public.notifiche_outbox (tenant_id, tipo, destinatario, payload)
  VALUES (
    p_tenant_id,
    'nuovo_ordine_web',
    COALESCE(v_dest, 'staff@tenant'),
    jsonb_build_object(
      'ordine_id', p_ordine_id,
      'source', 'web_checkout',
      'canale', v_canale
    )
  );
END;
$function$;

-- 3) chiudi_giornata / chiudi_ordini_aperti_fino_a: solo ruoli di chiusura cassa (+ superadmin).
CREATE OR REPLACE FUNCTION public.chiudi_ordini_aperti_fino_a(
  p_tenant_id uuid,
  p_data date DEFAULT (((now() AT TIME ZONE 'Europe/Rome'::text))::date - 1)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) IN ('admin', 'amministratore', 'gestore', 'cassa', 'owner')
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) = true
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorizzato per questo tenant.';
  END IF;

  UPDATE core.ordini o
  SET
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_consegna = CASE
      WHEN lower(trim(COALESCE(o.tipo_ordine, ''))) = 'delivery' THEN 'CONSEGNATO'
      ELSE o.stato_consegna
    END,
    stato_delivery = CASE
      WHEN lower(trim(COALESCE(o.tipo_ordine, ''))) = 'delivery'
           AND to_regtype('core.stato_delivery') IS NOT NULL
        THEN 'CONSEGNATO'::core.stato_delivery
      ELSE o.stato_delivery
    END,
    updated_at = now()
  WHERE o.tenant_id = p_tenant_id
    AND o.deleted_at IS NULL
    AND (o.created_at AT TIME ZONE 'Europe/Rome')::date <= p_data
    AND o.stato::text NOT IN ('CONSEGNATO', 'ANNULLATO');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.chiudi_giornata(p_tenant_id uuid, p_data date DEFAULT CURRENT_DATE, p_payload jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_id UUID;
  v_data DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
      AND COALESCE(attivo, true) = true
      AND (
        lower(trim(COALESCE(ruolo, ''))) IN ('admin', 'amministratore', 'gestore', 'cassa', 'owner')
        OR COALESCE(accesso_cassa, false) = true
      )
  ) AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) = true
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorizzato per questo tenant.';
  END IF;

  v_data := COALESCE(p_data, (now() AT TIME ZONE 'Europe/Rome')::date);

  INSERT INTO public.chiusure_giornata (tenant_id, data, payload)
  VALUES (p_tenant_id, v_data, p_payload)
  ON CONFLICT (tenant_id, data) DO UPDATE
    SET payload = COALESCE(EXCLUDED.payload, chiusure_giornata.payload),
        created_at = now()
  RETURNING id INTO v_id;

  PERFORM public.chiudi_ordini_aperti_fino_a(p_tenant_id, v_data);

  RETURN v_id;
END;
$function$;

-- 4) staff_password_note: la lettura diretta (SELECT) resta possibile solo al superadmin; un
--    tenant_admin deve passare dalla RPC admin_richiedi_password_nota (verifica password +
--    audit). Scrittura (nota nuova/aggiornata) resta invariata per il tenant_admin: non e' la
--    stessa superficie di rischio di una lettura in blocco di tutte le password.
DROP POLICY IF EXISTS staff_password_note_tenant_admin_all ON public.staff_password_note;

CREATE POLICY staff_password_note_superadmin_select ON public.staff_password_note
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
        AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
    )
  );

CREATE POLICY staff_password_note_tenant_admin_write ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid() AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
        AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid() AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
        AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
    )
  );

-- 5) delivery_update_stato_consegna: rimosso il bypass hardcoded sull'email di test.
CREATE OR REPLACE FUNCTION public.delivery_update_stato_consegna(
  p_ordine_id uuid,
  p_stato text,
  p_nome text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
  v_stato TEXT := upper(trim(COALESCE(p_stato, '')));
  v_delivery core.stato_delivery;
  v_rider_id UUID;
  v_curr_rider UUID;
  v_curr_stato TEXT;
  v_nome text := NULLIF(btrim(COALESCE(p_nome, '')), '');
  v_nome_rider text;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;
  IF v_stato NOT IN ('ASSEGNATO', 'IN_VIAGGIO', 'RICHIESTA', 'PROBLEMA') THEN
    RAISE EXCEPTION 'stato_non_valido';
  END IF;
  IF v_nome IS NOT NULL AND length(v_nome) > 60 THEN
    v_nome := left(v_nome, 60);
  END IF;

  SELECT o.tenant_id, o.rider_id, upper(trim(COALESCE(o.stato_consegna, '')))
  INTO v_tenant_id, v_curr_rider, v_curr_stato
  FROM core.ordini o WHERE o.id = p_ordine_id;
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
              'delivery', 'pony', 'cassa', 'admin', 'amministratore', 'gestore',
              'superadmin', 'super_admin', 'owner'
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
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) = true
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
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

  IF v_stato = 'IN_VIAGGIO' THEN
    v_rider_id := public.rider_ensure_me(v_tenant_id, v_nome);
    IF v_rider_id IS NOT NULL THEN
      SELECT NULLIF(btrim(COALESCE(r.nome_display, '')), '')
      INTO v_nome_rider
      FROM core.rider r
      WHERE r.id = v_rider_id;
    END IF;
  END IF;

  IF v_stato = 'IN_VIAGGIO' AND v_curr_stato = 'IN_VIAGGIO'
     AND v_curr_rider IS NOT NULL AND v_rider_id IS NOT NULL AND v_curr_rider IS DISTINCT FROM v_rider_id THEN
    RAISE EXCEPTION 'ordine_gia_preso';
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = v_stato,
    stato_delivery = v_delivery,
    rider_id = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(v_rider_id, o.rider_id)
      ELSE o.rider_id
    END,
    nome_pony = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(v_nome, o.nome_pony, v_nome_rider)
      ELSE o.nome_pony
    END,
    assegnato_rider_at = CASE
      WHEN v_stato = 'IN_VIAGGIO'
        AND o.assegnato_rider_at IS NULL
        AND COALESCE(v_rider_id, o.rider_id) IS NOT NULL
      THEN now()
      ELSE o.assegnato_rider_at
    END,
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (
      v_tenant_id,
      p_ordine_id,
      'delivery_update_stato',
      jsonb_build_object('stato', v_stato, 'nome_pony', v_nome),
      auth.uid()
    );
  END IF;
END;
$function$;

-- 6) Bucket tenant-logos: rimosso il listing pubblico (le immagini restano servite via URL
--    pubblico del bucket, indipendente da questa policy RLS su storage.objects).
DROP POLICY IF EXISTS tenant_logos_select_public ON storage.objects;

-- 7) pm_storage_path_tenant_id: search_path fissato esplicitamente.
CREATE OR REPLACE FUNCTION public.pm_storage_path_tenant_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_seg TEXT := NULLIF(split_part(COALESCE(object_name, ''), '/', 1), '');
BEGIN
  IF v_seg IS NULL OR v_seg !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN v_seg::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$function$;

-- 8) rider_ensure_me: verifica un ruolo operativo reale sul tenant richiesto.
CREATE OR REPLACE FUNCTION public.rider_ensure_me(
  p_tenant_id uuid,
  p_nome text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_nome text := NULLIF(btrim(COALESCE(p_nome, '')), '');
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;
  IF v_nome IS NOT NULL AND length(v_nome) > 60 THEN
    v_nome := left(v_nome, 60);
  END IF;

  -- Un rider gia' esistente su questo tenant puo' sempre aggiornare il proprio nome (non serve
  -- ricontrollare il ruolo ad ogni chiamata, il record e' gia' la prova di appartenenza).
  SELECT r.id INTO v_id
  FROM core.rider r
  WHERE r.auth_user_id = v_uid
    AND r.tenant_id = p_tenant_id
    AND r.deleted_at IS NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT COALESCE(
      EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = v_uid
          AND ur.tenant_id = p_tenant_id
          AND COALESCE(ur.attivo, true) = true
          AND (
            lower(trim(COALESCE(ur.ruolo, ''))) IN ('delivery', 'pony', 'cassa', 'admin', 'amministratore', 'gestore', 'owner')
            OR COALESCE(ur.accesso_delivery, false) = true
            OR COALESCE(ur.accesso_pony, false) = true
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur_sa
        WHERE ur_sa.user_id = v_uid
          AND COALESCE(ur_sa.attivo, true) = true
          AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
      ),
      false
    ) INTO v_allowed;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'tenant_non_autorizzato';
    END IF;

    IF v_nome IS NULL THEN
      RETURN NULL;
    END IF;
    BEGIN
      INSERT INTO core.rider (tenant_id, nome_display, auth_user_id, attivo)
      VALUES (p_tenant_id, v_nome, v_uid, true)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT r.id INTO v_id
      FROM core.rider r
      WHERE r.auth_user_id = v_uid
        AND r.tenant_id = p_tenant_id
        AND r.deleted_at IS NULL
      LIMIT 1;
      IF v_id IS NOT NULL THEN
        UPDATE core.rider SET nome_display = v_nome, updated_at = now() WHERE id = v_id;
      END IF;
    END;
  ELSIF v_nome IS NOT NULL THEN
    UPDATE core.rider SET nome_display = v_nome, updated_at = now() WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;
