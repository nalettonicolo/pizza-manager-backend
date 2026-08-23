-- =============================================================================
-- Modulo 58 — Carrelli in sospeso (CA-15)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 via MCP apply_migration.
-- =============================================================================
--
-- Richiesta: se un cliente a domicilio inserisce un ordine (da casa o al telefono con cassa)
-- ma non lo conferma, e poi richiama il negozio, cassa deve poter ritrovare il suo carrello
-- cercando/selezionando quel cliente. Un carrello in sospeso più vecchio di 5 giorni va
-- eliminato. Salvataggio: solo quando si lascia la pagina/il carrello (non ad ogni modifica).
--
-- Un solo carrello sospeso per cliente per tenant (UNIQUE tenant_id+cliente_id): un nuovo
-- salvataggio sovrascrive il precedente, coerente con "l'ultimo carrello non confermato".

CREATE TABLE IF NOT EXISTS core.carrelli_sospesi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  origine text NOT NULL DEFAULT 'cassa' CHECK (origine IN ('cassa', 'web')),
  tipo_ordine text,
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  checkout_note text,
  checkout_nome_cliente text,
  checkout_telefono_cliente text,
  checkout_selected_slot jsonb,
  delivery_search text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cliente_id)
);

COMMENT ON TABLE core.carrelli_sospesi IS
  'Carrello/ordine non confermato (da vetrina web o da cassa), recuperabile cercando il cliente. Eliminato dopo 5 giorni (CA-15).';

CREATE INDEX IF NOT EXISTS idx_carrelli_sospesi_tenant_updated
  ON core.carrelli_sospesi (tenant_id, updated_at);

-- Nessuna RLS su core.carrelli_sospesi: schema core non esposto a PostgREST (come le altre
-- tabelle core.*), accesso solo tramite le RPC SECURITY DEFINER seguenti.

CREATE OR REPLACE FUNCTION public.upsert_carrello_sospeso(
  p_tenant_id uuid,
  p_cliente_id uuid,
  p_origine text DEFAULT 'cassa',
  p_tipo_ordine text DEFAULT NULL,
  p_cart jsonb DEFAULT '[]'::jsonb,
  p_checkout_note text DEFAULT NULL,
  p_checkout_nome_cliente text DEFAULT NULL,
  p_checkout_telefono_cliente text DEFAULT NULL,
  p_checkout_selected_slot jsonb DEFAULT NULL,
  p_delivery_search text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pg_temp
AS $$
DECLARE
  v_authorized boolean;
  v_is_empty boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL OR p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'parametri_obbligatori';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = p_tenant_id AND COALESCE(ur.attivo, true) = true
  ) OR EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.id = p_cliente_id AND c.tenant_id = p_tenant_id
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clienti c WHERE c.id = p_cliente_id AND c.tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'cliente_non_valido_per_tenant';
  END IF;

  v_is_empty := (p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' OR jsonb_array_length(p_cart) = 0)
    AND NULLIF(trim(COALESCE(p_checkout_note, '')), '') IS NULL
    AND NULLIF(trim(COALESCE(p_checkout_nome_cliente, '')), '') IS NULL
    AND NULLIF(trim(COALESCE(p_checkout_telefono_cliente, '')), '') IS NULL;

  IF v_is_empty THEN
    DELETE FROM core.carrelli_sospesi WHERE tenant_id = p_tenant_id AND cliente_id = p_cliente_id;
    RETURN;
  END IF;

  INSERT INTO core.carrelli_sospesi (
    tenant_id, cliente_id, origine, tipo_ordine, cart,
    checkout_note, checkout_nome_cliente, checkout_telefono_cliente, checkout_selected_slot, delivery_search
  )
  VALUES (
    p_tenant_id, p_cliente_id, COALESCE(NULLIF(trim(p_origine), ''), 'cassa'), p_tipo_ordine, COALESCE(p_cart, '[]'::jsonb),
    p_checkout_note, p_checkout_nome_cliente, p_checkout_telefono_cliente, p_checkout_selected_slot, p_delivery_search
  )
  ON CONFLICT (tenant_id, cliente_id) DO UPDATE SET
    origine = EXCLUDED.origine,
    tipo_ordine = EXCLUDED.tipo_ordine,
    cart = EXCLUDED.cart,
    checkout_note = EXCLUDED.checkout_note,
    checkout_nome_cliente = EXCLUDED.checkout_nome_cliente,
    checkout_telefono_cliente = EXCLUDED.checkout_telefono_cliente,
    checkout_selected_slot = EXCLUDED.checkout_selected_slot,
    delivery_search = EXCLUDED.delivery_search,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_carrello_sospeso(uuid, uuid, text, text, jsonb, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_carrello_sospeso(uuid, uuid, text, text, jsonb, text, text, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_carrello_sospeso_cliente(
  p_tenant_id uuid,
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pg_temp
AS $$
DECLARE
  v_authorized boolean;
  v_row core.carrelli_sospesi%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL OR p_cliente_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = p_tenant_id AND COALESCE(ur.attivo, true) = true
  ) OR EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.id = p_cliente_id AND c.tenant_id = p_tenant_id
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Pulizia pigra: elimina i carrelli in sospeso scaduti (>5 giorni) di questo tenant ad ogni
  -- lettura — nessun cron necessario, la cassa cerca clienti più volte al giorno.
  DELETE FROM core.carrelli_sospesi
  WHERE tenant_id = p_tenant_id AND updated_at < now() - interval '5 days';

  SELECT * INTO v_row FROM core.carrelli_sospesi
  WHERE tenant_id = p_tenant_id AND cliente_id = p_cliente_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'origine', v_row.origine,
    'tipoOrdine', v_row.tipo_ordine,
    'cart', v_row.cart,
    'checkoutNote', v_row.checkout_note,
    'checkoutNomeCliente', v_row.checkout_nome_cliente,
    'checkoutTelefonoCliente', v_row.checkout_telefono_cliente,
    'checkoutSelectedSlot', v_row.checkout_selected_slot,
    'deliverySearch', v_row.delivery_search,
    'updatedAt', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_carrello_sospeso_cliente(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_carrello_sospeso_cliente(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_carrello_sospeso(
  p_tenant_id uuid,
  p_cliente_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pg_temp
AS $$
DECLARE
  v_authorized boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL OR p_cliente_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = p_tenant_id AND COALESCE(ur.attivo, true) = true
  ) OR EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.id = p_cliente_id AND c.tenant_id = p_tenant_id
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM core.carrelli_sospesi WHERE tenant_id = p_tenant_id AND cliente_id = p_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_carrello_sospeso(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_carrello_sospeso(uuid, uuid) TO authenticated;
