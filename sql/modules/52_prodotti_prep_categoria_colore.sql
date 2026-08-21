-- 52_prodotti_prep_categoria_colore.sql
-- Categoria/colore preparazione a livello PRODOTTO (non ingrediente): serve per colorare in
-- Cucina/Bancone/Pizzaiolo i task "prodotto intero" (prep_cucina=true, es. bibite/dolci/snack
-- fritti da preparare) con lo stesso schema colore-categoria già usato per gli ingredienti
-- (congelato/affettato/dolce/fritto/bibita/comune — vedi core.ingredienti.categoria/colore e
-- src/utils/cucinaPrepCategoryTheme.js). Colonne nullable, nessun default forzato: i prodotti
-- esistenti restano "comune" finché l'admin non sceglie una categoria (Admin → Menù → categoria
-- prodotto, campo "Prep. cucina").

ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS prep_categoria TEXT;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS prep_colore TEXT;

COMMENT ON COLUMN core.prodotti.prep_categoria IS
  'Categoria colore preparazione per i task "prodotto intero" (prep_cucina=true): stessi valori di core.ingredienti.categoria (congelato/affettato/dolce/fritto/bibita), o vuoto = comune.';
COMMENT ON COLUMN core.prodotti.prep_colore IS
  'Colore diretto (#hex) per il task "prodotto intero", stessa priorità di core.ingredienti.colore (ha precedenza su prep_categoria).';

-- Vista public."Prodotto": stessa definizione già in schema_completo, con le 2 colonne in più
-- aggiunte IN CODA (CREATE OR REPLACE VIEW non permette di inserirle "in mezzo" senza rinominare
-- le colonne successive — vedi errore 42P16 se si prova).
CREATE OR REPLACE VIEW public."Prodotto" WITH (security_invoker = true) AS
 SELECT id,
    nome,
    descrizione,
    prezzo,
    attivo,
    ordine,
    immagine_url,
    visibile_online,
    prep_cucina,
    tenant_id,
    categoria_id,
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt",
    prep_categoria,
    prep_colore
   FROM core.prodotti
  WHERE (tenant_id IN ( SELECT utenti_ruoli.tenant_id
           FROM utenti_ruoli
          WHERE utenti_ruoli.user_id = auth.uid()
        UNION
         SELECT clienti.tenant_id
           FROM clienti
          WHERE clienti.id = auth.uid()
        UNION
         SELECT rr.tenant_id
           FROM core.rider rr
          WHERE rr.auth_user_id = auth.uid() AND COALESCE(rr.attivo, true) IS NOT FALSE AND rr.deleted_at IS NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;
