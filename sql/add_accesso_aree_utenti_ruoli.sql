-- Permessi per area operative (pagina Admin → Ruoli): colonne su utenti_ruoli + vista ruoli_pizzeria.
-- Senza queste colonne, la modifica checkbox da errore PostgreSQL (column does not exist).
-- Esegui in Supabase → SQL Editor (una volta).

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

-- Necessario affinché l’admin possa aggiornare le righe (oltre alla policy RLS).
GRANT UPDATE ON public.utenti_ruoli TO authenticated;
