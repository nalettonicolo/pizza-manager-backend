-- =============================================================================
-- Modulo 60 — Scadenza sconto per tenant (promozioni con scadenza)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 via MCP apply_migration.
-- =============================================================================
--
-- Il Super Admin poteva già impostare uno sconto (percentuale su admin.tenants.sconto_percentuale
-- + importo fisso dentro parametri_operativi.sconto_importo_euro) ma senza nessuna scadenza: una
-- volta impostato restava attivo per sempre finché qualcuno non tornava a toglierlo a mano.
-- Aggiunge una data di scadenza condivisa per entrambi i tipi di sconto (percentuale e/o fisso):
-- oltre quella data il canone netto mostrato torna al listino pieno, senza cancellare i valori
-- impostati (comodo per riattivare la stessa promozione più avanti).

ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sconto_scadenza date;

COMMENT ON COLUMN admin.tenants.sconto_scadenza IS
  'Data di scadenza della promozione (sconto_percentuale + parametri_operativi.sconto_importo_euro). NULL = nessuna scadenza. Oltre questa data lo sconto non si applica più al canone stimato, senza azzerare i valori.';

CREATE OR REPLACE VIEW public.tenants AS
  SELECT
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
    sconto_scadenza
  FROM admin.tenants;
