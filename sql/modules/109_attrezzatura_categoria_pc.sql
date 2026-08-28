-- Modulo 109 — Aggiunge "pc" alle categorie di attrezzatura a noleggio
--
-- Richiesta esplicita dell'utente in "Preventivi e contratti" (catalogo attrezzature): mancava
-- la categoria "pc" tra le opzioni. Il frontend (CATEGORIE_ATTREZZATURA in
-- SuperadminPreventiviContrattiPage.jsx) da solo non basta: attrezzature_catalogo.categoria ha un
-- CHECK esplicito sull'elenco valori, quindi va esteso anche qui o l'insert fallisce.

alter table public.attrezzature_catalogo drop constraint if exists attrezzature_catalogo_categoria_check;
alter table public.attrezzature_catalogo add constraint attrezzature_catalogo_categoria_check
  check (categoria in (
    'tablet', 'pc', 'stampante', 'pos', 'router', 'lettore_barcode', 'kit_completo', 'altro'
  ));
