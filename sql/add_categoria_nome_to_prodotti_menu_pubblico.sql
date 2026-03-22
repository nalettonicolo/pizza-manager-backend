-- Aggiunge categoria_nome alla vista menu pubblico (home pizzeria: tab per categoria senza GRANT su categorie).
-- Esegui in Supabase → SQL Editor (una volta).

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
