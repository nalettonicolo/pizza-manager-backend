-- Modulo 112 — Fix: public.tenants (vista) non esponeva sito_web_cliente
--
-- Bug reale trovato dall'utente: "non salva https://pizzamanager.it sul profilo cliente".
-- admin.tenants.sito_web_cliente esiste (aggiunta dal modulo 91), ma la vista public.tenants —
-- usata da tutto il frontend, perché admin.* non è esposto via PostgREST — non la includeva nel
-- SELECT. Il salvataggio da Tenants.jsx passa da updateTenantPublicDomain(), che ha un retry
-- automatico che RIMUOVE i campi mancanti sulla vista e ripete l'update senza errore visibile:
-- il valore veniva quindi scartato in silenzio, mai scritto su admin.tenants.

create or replace view public.tenants
  with (security_invoker = true)
  as
  select
    id,
    nome,
    piano,
    stripe_customer_id,
    stripe_subscription_id,
    attivo,
    created_at,
    slug,
    updated_at,
    deleted_at,
    partita_iva,
    email_fatturazione,
    pec,
    codice_univoco_sdi,
    addebito_automatico_mensile,
    data_attivazione_abbonamento,
    sconto_percentuale,
    logo_url,
    email,
    telefono,
    indirizzo,
    lat,
    lng,
    parametri_operativi,
    orari_settimana,
    prova_valida_fino,
    public_domain,
    public_domain_status,
    public_domain_requested_at,
    sconto_scadenza,
    sito_web_cliente
  from admin.tenants;
