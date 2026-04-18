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

-- -----------------------------------------------------------------------------
-- 2026-04-19 — Ingredienti: prep_cucina + categoria/colore (Cucina/Bancone).
-- Su DB con vista public.ingredienti + trigger INSTEAD OF, prima questi campi
-- non venivano letti né scritti su core.ingredienti.
-- -----------------------------------------------------------------------------
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS colore TEXT;

CREATE OR REPLACE FUNCTION public.ingredienti_insert()
RETURNS TRIGGER AS $$
DECLARE r core.ingredienti;
BEGIN
  INSERT INTO core.ingredienti (tenant_id, nome, costo_unitario, unita_misura, attivo, ordine, va_in_cottura, costo_abbondante, costo_senza, costo_poco,
    prep_cucina, categoria, colore)
  VALUES (NEW.tenant_id, NEW.nome, COALESCE(NEW.costo_unitario, 0), NEW.unita_misura, COALESCE(NEW.attivo, true), COALESCE(NEW.ordine, 0), COALESCE(NEW.va_in_cottura, false), NEW.costo_abbondante, NEW.costo_senza, NEW.costo_poco,
    COALESCE(NEW.prep_cucina, false), NULLIF(trim(COALESCE(NEW.categoria, '')), ''), NULLIF(trim(COALESCE(NEW.colore, '')), ''))
  RETURNING * INTO r;
  NEW.id := r.id; NEW.deleted_at := r.deleted_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.ingredienti_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.ingredienti SET
    nome = NEW.nome,
    costo_unitario = COALESCE(NEW.costo_unitario, 0),
    unita_misura = NEW.unita_misura,
    attivo = COALESCE(NEW.attivo, true),
    ordine = COALESCE(NEW.ordine, 0),
    va_in_cottura = COALESCE(NEW.va_in_cottura, false),
    costo_abbondante = NEW.costo_abbondante,
    costo_senza = NEW.costo_senza,
    costo_poco = NEW.costo_poco,
    prep_cucina = COALESCE(NEW.prep_cucina, false),
    categoria = NULLIF(trim(COALESCE(NEW.categoria, '')), ''),
    colore = NULLIF(trim(COALESCE(NEW.colore, '')), '')
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $ing_patch$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ingredienti' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW IF EXISTS public."Ingrediente" CASCADE';
    EXECUTE 'DROP VIEW IF EXISTS public.ingredienti CASCADE';
    EXECUTE $cre$
CREATE VIEW public.ingredienti AS
  SELECT i.id, i.tenant_id, i.nome, i.costo_unitario, i.unita_misura, i.attivo, i.deleted_at, i.ordine, i.va_in_cottura,
         i.costo_abbondante, i.costo_senza, i.costo_poco,
         i.prep_cucina, i.categoria, i.colore
  FROM core.ingredienti i
  WHERE i.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
    $cre$;
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredienti TO authenticated';
    EXECUTE 'CREATE VIEW public."Ingrediente" AS SELECT * FROM public.ingredienti';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ingrediente" TO authenticated';
    EXECUTE 'DROP TRIGGER IF EXISTS ingredienti_insert_trigger ON public.ingredienti';
    EXECUTE 'CREATE TRIGGER ingredienti_insert_trigger INSTEAD OF INSERT ON public.ingredienti FOR EACH ROW EXECUTE FUNCTION public.ingredienti_insert()';
    EXECUTE 'DROP TRIGGER IF EXISTS ingredienti_update_trigger ON public.ingredienti';
    EXECUTE 'CREATE TRIGGER ingredienti_update_trigger INSTEAD OF UPDATE ON public.ingredienti FOR EACH ROW EXECUTE FUNCTION public.ingredienti_update()';
    EXECUTE 'DROP TRIGGER IF EXISTS ingredienti_delete_trigger ON public.ingredienti';
    EXECUTE 'CREATE TRIGGER ingredienti_delete_trigger INSTEAD OF DELETE ON public.ingredienti FOR EACH ROW EXECUTE FUNCTION public.ingredienti_delete()';
  END IF;
END
$ing_patch$;

-- -----------------------------------------------------------------------------
-- 2026-04-19 — staff_archivio_dipendenti: schede HR anche senza account (user_id NULL).
-- -----------------------------------------------------------------------------
ALTER TABLE public.staff_archivio_dipendenti ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.staff_archivio_dipendenti.user_id IS
  'Utente Auth collegato opzionale; NULL = dipendente solo archivio HR (nessun login).';
