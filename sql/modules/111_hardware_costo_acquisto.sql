-- Modulo 111 — Costo di acquisto per il catalogo Hardware (margine interno PizzaManager)
--
-- Richiesta esplicita dell'utente in "Catalogo Hardware": canone_noleggio_mensile e
-- prezzo_vendita sono i prezzi applicati al CLIENTE; serve anche il costo di ACQUISTO (quanto
-- paga PizzaManager al fornitore) per calcolare il proprio margine. Mai esposto nei
-- contratti/preventivi del cliente (buildContrattoCommercialeDati non lo legge) — solo interno,
-- visibile e modificabile dal superadmin nella pagina di gestione del catalogo.

alter table public.attrezzature_catalogo add column if not exists costo_acquisto numeric;
comment on column public.attrezzature_catalogo.costo_acquisto is
  'Costo di acquisto dal fornitore (interno, mai esposto ai tenant) — usato per calcolare il margine di PizzaManager su vendita/noleggio del prodotto.';
