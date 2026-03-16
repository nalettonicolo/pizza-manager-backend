-- Permessi per utenti anonimi (menu pubblico e info tenant senza login).
-- Esegui in Supabase → SQL Editor (una volta).
-- Risolve: "permission denied for schema public" (42501) su menu/tenant pubblico.

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public."Prodotto" TO anon;
GRANT SELECT ON public.punti_vendita TO anon;
GRANT SELECT ON public.prodotti_menu_pubblico TO anon;
