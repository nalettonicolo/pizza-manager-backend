-- Modulo 85 — Fix: GRANT mancanti sulle tabelle/viste dei moduli 76-84
--
-- Trovato in verifica live (2026-08-26): tutte le tabelle create nei moduli 76-84 avevano
-- RLS + policy corrette, ma senza GRANT esplicito a anon/authenticated Postgres nega
-- l'accesso PRIMA di valutare la RLS (42501 "permission denied"), indipendentemente dalle
-- policy. Il progetto non ha default privileges sullo schema public: ogni tabella nuova
-- richiede GRANT espliciti, come da convenzione già in uso (vedi es. 33_sa_support_punti_vendita.sql).
-- Additivo, idempotente, nessun DROP/DELETE/REVOKE.

-- Solo staff autenticato (RLS limita a superadmin o tenant proprietario)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornitore_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_documenti TO authenticated;
GRANT SELECT ON public.v_tenant_documenti_attuali TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attrezzature_catalogo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_noleggi TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_noleggi_rate TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concorrenti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_marketing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campagne_ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campagne_ads_metriche TO authenticated;
GRANT SELECT ON public.v_campagne_ads_riepilogo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrazioni_automazione TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campagne_ads_pubblicazioni_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_configurazione TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_conversazioni TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.richieste_funzionalita_non_disponibili TO authenticated;

-- Contenuto pubblico: anche il visitatore anonimo del sito deve poter leggere
-- (RLS filtra comunque su pubblicata/pubblicato = true, o è dichiaratamente pubblico).
GRANT SELECT ON public.faq_pubbliche TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_pubbliche TO authenticated;
GRANT SELECT ON public.landing_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT SELECT ON public.blog_articoli TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_articoli TO authenticated;
GRANT SELECT ON public.piani_riferimento TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.piani_riferimento TO authenticated;
GRANT SELECT ON public.moduli_catalogo TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moduli_catalogo TO authenticated;
