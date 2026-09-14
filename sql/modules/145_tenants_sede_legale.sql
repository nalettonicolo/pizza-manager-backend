-- Modulo 145 — Aggiunge admin.tenants.sede_legale (indirizzo della sede legale, se diverso da
-- quello operativo "indirizzo" già esistente). Richiesta: il riconoscimento tenant via Partita
-- IVA nel wizard di installazione dell'app desktop (vedi electron/build/installer.nsh e la
-- edge function verifica-piva-tenant) deve poter mostrare entrambe le sedi quando differiscono,
-- per un'esperienza più professionale/completa in fase di setup.
--
-- Colonna facoltativa (NULL = non compilata, o coincidente con la sede operativa): editabile da
-- Superadmin → Clienti insieme agli altri dati fiscali (partita_iva, pec, codice_univoco_sdi).

ALTER TABLE admin.tenants
  ADD COLUMN IF NOT EXISTS sede_legale text;

COMMENT ON COLUMN admin.tenants.sede_legale IS
  'Indirizzo della sede legale, se diverso dalla sede operativa (colonna "indirizzo"). Facoltativo.';

-- La vista public.tenants deve restare security_invoker=true (RLS della tabella sottostante
-- valutata con i permessi di chi interroga, non del proprietario della vista) — va sempre
-- ripetuto esplicitamente ad ogni CREATE OR REPLACE, altrimenti torna al default silenziosamente.
CREATE OR REPLACE VIEW public.tenants
WITH (security_invoker = true) AS
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
  sconto_scadenza,
  sito_web_cliente,
  sede_legale
FROM admin.tenants;
