-- =============================================================================
-- Modulo 62 — Indici mancanti trovati durante una revisione prestazioni
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 via MCP apply_migration.
-- =============================================================================
--
-- Nessun cambio di comportamento: solo indici aggiuntivi, sicuri e reversibili (DROP INDEX),
-- su percorsi di query reali già in uso nel codice.

-- "I miei ordini" e dettaglio ordine lato cliente (cliente_lista_propri_ordini,
-- cliente_dettaglio_proprio_ordine): filtrano per tenant_id + web_cliente_user_id, mai coperto
-- da un indice dedicato — usavano solo l'indice tenant_id/created_at, quindi Postgres doveva
-- scandagliare TUTTI gli ordini del tenant (non solo quelli di oggi) per trovare quelli del cliente.
CREATE INDEX IF NOT EXISTS idx_ordini_tenant_web_cliente
  ON core.ordini (tenant_id, web_cliente_user_id, created_at DESC)
  WHERE web_cliente_user_id IS NOT NULL AND deleted_at IS NULL;

-- Webhook Stripe (edge_stripe_mark_payment_succeeded/_failed, modulo 59): aggiorna
-- payment_link_intents cercando per provider_intent_id, senza nessun indice su quella colonna
-- (solo su ordine_id e su tenant_id+status). Stesso pattern già indicizzato su core.ordini
-- (idx_ordini_online_payment_stripe_pi) ma mancante qui.
CREATE INDEX IF NOT EXISTS idx_payment_link_intents_provider_intent
  ON public.payment_link_intents (provider_intent_id)
  WHERE provider_intent_id IS NOT NULL;
