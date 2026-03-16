-- Aggiunge colonna visibile_online e vista menu pubblico (risolve "column Prodotto.visibile_online does not exist").
-- Esegui in Supabase → SQL Editor (una volta).

-- 1. Colonna su core.prodotti
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS visibile_online BOOLEAN DEFAULT true;

-- 2. Aggiorna vista Prodotto (per utenti loggati) includendo visibile_online
DROP VIEW IF EXISTS public."Prodotto" CASCADE;
CREATE VIEW public."Prodotto" AS
  SELECT id, nome, descrizione, prezzo, attivo, ordine, immagine_url, visibile_online,
         tenant_id, categoria_id,
         created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
  FROM core.prodotti
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;

-- 3. Vista per menu pubblico (anon): nessun filtro auth, solo prodotti attivi e visibili
DROP VIEW IF EXISTS public.prodotti_menu_pubblico CASCADE;
CREATE VIEW public.prodotti_menu_pubblico AS
  SELECT id, nome, descrizione, prezzo, attivo, ordine, immagine_url, visibile_online,
         tenant_id, categoria_id,
         created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
  FROM core.prodotti
  WHERE deleted_at IS NULL
    AND (attivo = true OR attivo IS NULL)
    AND (visibile_online = true OR visibile_online IS NULL);
GRANT SELECT ON public.prodotti_menu_pubblico TO anon;
