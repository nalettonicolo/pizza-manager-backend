-- Modulo 91 — Fix bug reale in produzione: admin.tenants.sito_web_cliente mancante
--
-- La colonna era già scritta in sql/schema_completo_pizzamanager.sql e attesa dal frontend
-- (Tenants.jsx, superadminService.js) ma non era mai stata applicata al DB live. Effetto:
-- ogni salvataggio del form Tenants (Super Admin → Clienti) falliva sull'update completo
-- (colonna inesistente), scattava il fallback tenantRowMinimal() che esclude ANCHE
-- public_domain — il salvataggio sembrava "riuscire" (nessun errore visibile in UI) ma il
-- dominio del tenant non veniva mai scritto. Trovato mentre si testava il collegamento
-- domini per i tenant demo (2026-08-27).
-- Additivo, idempotente, nessun impatto su dati esistenti.

ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sito_web_cliente text;
COMMENT ON COLUMN admin.tenants.sito_web_cliente IS 'URL completo del sito web del cliente (marketing, Google Sites, ecc.); non è usato per la risoluzione tenant';
