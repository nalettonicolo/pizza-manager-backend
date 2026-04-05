-- =============================================================================
-- PizzaManager — Ultime implementazioni SQL (consolidato)
-- Data riferimento: 2026-04
--
-- Contenuto (idempotente dove possibile):
--   1) public.staff_password_note — archivio note password staff (Admin Ruoli)
--   2) RLS staff_password_note — tenant_admins OPPURE superadmin (utenti_ruoli)
--   3) Vista public.ruoli_pizzeria — superadmin vede tutti i tenant
--   4) subscriptions — ciclo_fatturazione_giorni + sconto_annuale_percent (public e/o core)
--   5) core.ordini — colonne cassa / ordine cliente (note, pagamento, tipo, ritiro…)
--   6) core.riga_ordine — formato_nome, ingredienti_cottura_summary (comanda / cassa)
--   7) public.create_order_with_items — RPC allineata a adminService (Supabase JS)
--
-- App (senza DDL qui): Admin Magazzino/Contabilità usa ancora localStorage per tenant;
--   parametri_operativi (JSON su tenants) — comanda / cassa (CassaImpostazioniPage + printComanda.js):
--   comanda_copie, comanda_font_size (px 8–28), comanda_titolo_scale, comanda_qty_scale,
--   comanda_dettaglio_scale, comanda_line_height, comanda_margin_mm, comanda_width_mm,
--   comanda_font_family (system|sans|mono|serif), comanda_mostra_id_ordine, comanda_mostra_pagamento,
--   comanda_mostra_dest_stampanti, comanda_stampanti[], comanda_stampa_auto;
--   più ritiro_ogni_min, pizze_ogni_15_min, consegne_ogni_min, …
--
-- Prerequisiti tipici: public.utenti_ruoli, public.tenant_admins, auth.users,
--   core.tenants (FK su staff_password_note). Esegui su Supabase (SQL Editor) o CLI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1–2) Tabella + RLS staff_password_note (admin tenant + superadmin piattaforma)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_password_note (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants (id) ON DELETE CASCADE,
  password_nota TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_password_note_tenant ON public.staff_password_note (tenant_id);

ALTER TABLE public.staff_password_note ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_password_note TO authenticated;

COMMENT ON TABLE public.staff_password_note IS
  'Nota password accesso staff (archivio titolare). RLS: tenant_admins del tenant o superadmin (utenti_ruoli). Non è la password Auth.';

-- -----------------------------------------------------------------------------
-- 3) Vista ruoli_pizzeria: superadmin vede tutti gli staff; altri solo il proprio tenant
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
-- 4) Abbonamenti: ciclo (codice 30/365 = mesi di calendario in app) + sconto annuale %
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN public.subscriptions.ciclo_fatturazione_giorni IS
      'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN public.subscriptions.sconto_annuale_percent IS
      'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;

  IF to_regclass('core.subscriptions') IS NOT NULL THEN
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN core.subscriptions.ciclo_fatturazione_giorni IS
      'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN core.subscriptions.sconto_annuale_percent IS
      'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5–6) Ordini e righe: campi usati da Cassa (createOrder) e stampa comanda
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NOT NULL THEN
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_ordine TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS orario_ritiro TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS indirizzo_consegna TEXT;
    COMMENT ON COLUMN core.ordini.tipo_ordine IS 'es. negozio | delivery (cassa / clienti).';
    COMMENT ON COLUMN core.ordini.orario_ritiro IS 'Fascia oraria ritiro/consegna scelta in cassa.';
  END IF;

  IF to_regclass('core.riga_ordine') IS NOT NULL THEN
    ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS formato_nome TEXT;
    ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS ingredienti_cottura_summary TEXT;
    COMMENT ON COLUMN core.riga_ordine.ingredienti_cottura_summary IS 'Testo riepilogo modifiche ingredienti/cottura per cucina e comanda.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7) RPC create_order_with_items (firma allineata a src/features/admin/services/adminService.js)
--     Rimuove overload public/core preesistenti con lo stesso nome, poi crea public.
-- -----------------------------------------------------------------------------
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), '')
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Crea ordine + righe (cassa). p_items: prodotto_id, quantita, prezzo, formato_nome, ingredienti_cottura_summary.';

-- =============================================================================
-- Fidelity Card (servizio `fidelity_card`): tabelle public.fidelity_saldi e
-- public.fidelity_movimenti. Copia integrale da:
--   supabase/migrations/20260403170000_fidelity_card.sql
-- =============================================================================

-- =============================================================================
-- Fine. Dopo l'esecuzione: Dashboard Supabase → Settings → API → Reload schema
--   se PostgREST non espone subito le nuove colonne/viste.
-- =============================================================================
