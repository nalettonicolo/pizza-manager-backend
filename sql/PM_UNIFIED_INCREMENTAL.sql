-- =============================================================================
-- PizzaManager — SQL incrementale unificato (idempotente)
--
-- PM-SQL-REF: UNIFIED-INCR-v1-2026-03-22
-- PM-SQL-FP:   E7A4C91B2D804E6F9A1C5E8B3F0D2A74
--
-- Uso: database già inizializzato (es. dopo schema bootstrap). Esegui in
-- Supabase → SQL Editor. Non sostituisce sql/schema_completo_pizzamanager.sql.
--
-- Contiene: visibile_online, viste public, colonne accesso aree, GRANT anon,
--           pattern RLS/policy idempotenti dove applicabile.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) core.prodotti — visibilità menu online
-- -----------------------------------------------------------------------------
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS visibile_online BOOLEAN DEFAULT true;


-- -----------------------------------------------------------------------------
-- 2) Vista public."Prodotto" (client app / autenticati)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public."Prodotto" CASCADE;
CREATE VIEW public."Prodotto" AS
  SELECT
    id,
    nome,
    descrizione,
    prezzo,
    attivo,
    ordine,
    immagine_url,
    visibile_online,
    tenant_id,
    categoria_id,
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.prodotti
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;


-- -----------------------------------------------------------------------------
-- 3) Vista prodotti_menu_pubblico (anon + nome categoria)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.prodotti_menu_pubblico CASCADE;
CREATE VIEW public.prodotti_menu_pubblico AS
  SELECT
    p.id,
    p.nome,
    p.descrizione,
    p.prezzo,
    p.attivo,
    p.ordine,
    p.immagine_url,
    p.visibile_online,
    p.tenant_id,
    p.categoria_id,
    cat.nome AS categoria_nome,
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt",
    p.deleted_at AS "deletedAt"
  FROM core.prodotti p
  LEFT JOIN core.categorie cat ON cat.id = p.categoria_id
  WHERE p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL);

GRANT SELECT ON public.prodotti_menu_pubblico TO anon;


-- -----------------------------------------------------------------------------
-- 4) public.utenti_ruoli — permessi aree operative (Admin → Ruoli)
-- -----------------------------------------------------------------------------
ALTER TABLE public.utenti_ruoli
  ADD COLUMN IF NOT EXISTS accesso_riepilogo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_cassa BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_cucina BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_bancone BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_pizzaiolo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_delivery BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_pony BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.utenti_ruoli.accesso_riepilogo IS 'Area operativa Riepilogo';
COMMENT ON COLUMN public.utenti_ruoli.accesso_cassa IS 'Area Cassa';
COMMENT ON COLUMN public.utenti_ruoli.accesso_cucina IS 'Area Cucina';
COMMENT ON COLUMN public.utenti_ruoli.accesso_bancone IS 'Area Bancone';
COMMENT ON COLUMN public.utenti_ruoli.accesso_pizzaiolo IS 'Area Pizzaioli';
COMMENT ON COLUMN public.utenti_ruoli.accesso_delivery IS 'Area Delivery';
COMMENT ON COLUMN public.utenti_ruoli.accesso_pony IS 'Area Pony (stesso reparto Delivery)';


-- -----------------------------------------------------------------------------
-- 5) Vista ruoli_pizzeria
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
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;
GRANT UPDATE ON public.utenti_ruoli TO authenticated;


-- -----------------------------------------------------------------------------
-- 6) GRANT schema public / letture anon (menu pubblico, tenant)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public."Prodotto" TO anon;
GRANT SELECT ON public.punti_vendita TO anon;
GRANT SELECT ON public.prodotti_menu_pubblico TO anon;


-- -----------------------------------------------------------------------------
-- 7) RLS — attivazione idempotente (senza sovrascrivere policy esistenti)
-- -----------------------------------------------------------------------------
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

-- Pattern per nuove policy (idempotente): sempre DROP POLICY IF EXISTS + CREATE POLICY.
-- Esempio:
--   DROP POLICY IF EXISTS "nome_policy" ON public.utenti_ruoli;
--   CREATE POLICY "nome_policy" ON public.utenti_ruoli FOR ... TO authenticated USING (...);
--
-- Le policy complete (anche con public.tenant_admins) sono in
-- sql/schema_completo_pizzamanager.sql — non duplicarle qui se il DB è già allineato.


-- -----------------------------------------------------------------------------
-- 8) OPZIONALE — superadmin in utenti_ruoli (sostituisci UUID e tenant)
-- -----------------------------------------------------------------------------
-- INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id, attivo)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'superadmin',
--   (SELECT id FROM core.tenants ORDER BY created_at NULLS LAST LIMIT 1),
--   true
-- )
-- ON CONFLICT (user_id) DO UPDATE SET
--   ruolo = EXCLUDED.ruolo,
--   tenant_id = EXCLUDED.tenant_id,
--   attivo = true;

-- =============================================================================
-- Fine PM-SQL-REF: UNIFIED-INCR-v1-2026-03-22
-- =============================================================================
