-- Modulo 131 — Archivio Documenti del locale (contratti, pagamenti, comunicazioni)
--
-- Il gestore vede in Admin → Documenti quanto PizzaManager deposita per il tenant.
-- Nuovi tipi: pagamento, comunicazione. Invio email generico (variante 'documento').
-- Additivo, idempotente.

ALTER TABLE public.tenant_documenti DROP CONSTRAINT IF EXISTS tenant_documenti_tipo_documento_check;
ALTER TABLE public.tenant_documenti ADD CONSTRAINT tenant_documenti_tipo_documento_check
  CHECK (tipo_documento IN (
    'termini_servizio', 'privacy_policy', 'contratto_abbonamento', 'dpa', 'addendum_noleggio',
    'contratto_commerciale', 'preventivo_commerciale',
    'pagamento', 'comunicazione'
  ));

CREATE OR REPLACE FUNCTION public.sa_enqueue_documento_email(
  p_documento_id uuid,
  p_variante text,
  p_destinatario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $$
DECLARE
  v_doc public.tenant_documenti%ROWTYPE;
  v_dest text;
  v_nome text;
  v_subject text;
  v_body text;
  v_html text;
  v_filename text;
  v_notifica_id uuid;
  v_tipo_label text;
  v_titolo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pm_auth_is_superadmin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_documento_id IS NULL OR NULLIF(trim(p_variante), '') IS NULL THEN
    RAISE EXCEPTION 'Parametri mancanti';
  END IF;

  IF trim(p_variante) NOT IN ('preventivo', 'contratto_da_firmare', 'contratto_firmato', 'documento') THEN
    RAISE EXCEPTION 'Variante email non valida';
  END IF;

  SELECT * INTO v_doc
  FROM public.tenant_documenti
  WHERE id = p_documento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento non trovato';
  END IF;

  IF v_doc.pdf_url IS NULL OR trim(v_doc.pdf_url) = '' THEN
    RAISE EXCEPTION 'Il documento non ha ancora un PDF da allegare';
  END IF;

  IF trim(p_variante) = 'preventivo' AND v_doc.tipo_documento <> 'preventivo_commerciale' THEN
    RAISE EXCEPTION 'Questo documento non è un preventivo';
  END IF;

  IF trim(p_variante) = 'contratto_firmato' AND v_doc.stato <> 'firmato' THEN
    RAISE EXCEPTION 'Il contratto non risulta firmato';
  END IF;

  IF v_doc.stato = 'annullato' THEN
    RAISE EXCEPTION 'Documento annullato';
  END IF;

  SELECT
    COALESCE(NULLIF(trim(t.nome), ''), 'cliente'),
    COALESCE(
      NULLIF(trim(p_destinatario), ''),
      NULLIF(trim(t.email_fatturazione), ''),
      NULLIF(trim(t.pec), '')
    )
  INTO v_nome, v_dest
  FROM admin.tenants t
  WHERE t.id = v_doc.tenant_id;

  IF v_dest IS NULL OR position('@' in v_dest) = 0 THEN
    RAISE EXCEPTION 'Manca un indirizzo email del cliente (fatturazione o PEC). Impostalo in Clienti oppure inseriscilo qui.';
  END IF;

  v_titolo := NULLIF(trim(v_doc.dati_snapshot ->> 'titolo'), '');

  v_tipo_label := CASE v_doc.tipo_documento
    WHEN 'preventivo_commerciale' THEN 'Preventivo'
    WHEN 'contratto_commerciale' THEN 'Contratto commerciale'
    WHEN 'contratto_abbonamento' THEN 'Contratto di abbonamento'
    WHEN 'addendum_noleggio' THEN 'Addendum noleggio'
    WHEN 'termini_servizio' THEN 'Termini di servizio'
    WHEN 'privacy_policy' THEN 'Informativa privacy'
    WHEN 'dpa' THEN 'Accordo sul trattamento dei dati (DPA)'
    WHEN 'pagamento' THEN COALESCE(v_titolo, 'Documento di pagamento')
    WHEN 'comunicazione' THEN COALESCE(v_titolo, 'Comunicazione')
    ELSE COALESCE(v_titolo, 'Documento')
  END;

  IF trim(p_variante) = 'preventivo' THEN
    v_subject := 'Preventivo PizzaManager — ' || v_nome;
    v_filename := 'Preventivo-PizzaManager.pdf';
    v_body :=
      'Gentile ' || v_nome || ',' || E'\n\n' ||
      'in allegato trova il preventivo PizzaManager.' || E'\n\n' ||
      'Per domande o per procedere alla sottoscrizione risponda a questa email.' || E'\n\n' ||
      'Un saluto,' || E'\n' ||
      'PizzaManager';
  ELSIF trim(p_variante) = 'contratto_da_firmare' THEN
    v_subject := v_tipo_label || ' PizzaManager da firmare — ' || v_nome;
    v_filename := 'Contratto-PizzaManager-da-firmare.pdf';
    v_body :=
      'Gentile ' || v_nome || ',' || E'\n\n' ||
      'in allegato trova il ' || lower(v_tipo_label) || ' da firmare.' || E'\n\n' ||
      'La preghiamo di firmarlo e di rinviarlo in risposta a questa email. Se preferisce, possiamo fissare una firma su tablet in presenza.' || E'\n\n' ||
      'Un saluto,' || E'\n' ||
      'PizzaManager';
  ELSIF trim(p_variante) = 'contratto_firmato' THEN
    v_subject := v_tipo_label || ' PizzaManager firmato — ' || v_nome;
    v_filename := 'Contratto-PizzaManager-firmato.pdf';
    v_body :=
      'Gentile ' || v_nome || ',' || E'\n\n' ||
      'in allegato trova copia del ' || lower(v_tipo_label) || ' firmato' ||
      CASE WHEN NULLIF(trim(v_doc.firmato_da), '') IS NOT NULL
        THEN ' da ' || trim(v_doc.firmato_da)
        ELSE ''
      END ||
      '.' || E'\n\n' ||
      'Conservi questo messaggio come riferimento. Lo trova anche in Documenti nella console del locale.' || E'\n\n' ||
      'Un saluto,' || E'\n' ||
      'PizzaManager';
  ELSE
    v_subject := v_tipo_label || ' — PizzaManager / ' || v_nome;
    v_filename := regexp_replace(lower(v_tipo_label), '[^a-z0-9]+', '-', 'g') || '.pdf';
    v_body :=
      'Gentile ' || v_nome || ',' || E'\n\n' ||
      'in allegato trova: ' || v_tipo_label || '.' || E'\n\n' ||
      'Il documento è disponibile anche in Documenti nella console del locale.' || E'\n\n' ||
      'Un saluto,' || E'\n' ||
      'PizzaManager';
  END IF;

  v_html := '<p>' || replace(replace(v_body, E'\n\n', '</p><p>'), E'\n', '<br/>') || '</p>';

  INSERT INTO public.notifiche_outbox (tenant_id, tipo, destinatario, payload)
  VALUES (
    v_doc.tenant_id,
    'documento_commerciale',
    v_dest,
    jsonb_build_object(
      'canale', 'email',
      'usa_smtp_piattaforma', true,
      'subject', v_subject,
      'oggetto', v_subject,
      'body', v_body,
      'html', v_html,
      'pdf_storage_path', v_doc.pdf_url,
      'pdf_filename', v_filename,
      'variante', trim(p_variante),
      'documento_id', v_doc.id,
      'tipo_documento', v_doc.tipo_documento
    )
  )
  RETURNING id INTO v_notifica_id;

  UPDATE public.tenant_documenti
  SET
    inviato_email_at = now(),
    inviato_email_a = v_dest,
    inviato_email_variante = trim(p_variante)
  WHERE id = v_doc.id;

  RETURN jsonb_build_object(
    'ok', true,
    'notifica_id', v_notifica_id,
    'destinatario', v_dest,
    'variante', trim(p_variante)
  );
END;
$$;

COMMENT ON FUNCTION public.sa_enqueue_documento_email(uuid, text, text) IS
  'Superadmin: accoda email al cliente con PDF (preventivo, contratto, pagamento, comunicazione).';

NOTIFY pgrst, 'reload schema';
