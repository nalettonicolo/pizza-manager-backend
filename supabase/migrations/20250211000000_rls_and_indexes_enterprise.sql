-- ============================================
-- PIZZAMANAGER – RLS e indici enterprise
-- Eseguire su Supabase (schema public o core)
-- ============================================

-- Indici consigliati (adatta i nomi schema/tabella se usi "core")
-- Assumendo tabelle in schema public; se usi core.tenants ecc. sostituisci.

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_attivo ON tenants(attivo);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stato ON subscriptions(stato);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entita_entita_id ON audit_logs(entita, entita_id);

-- Ordini (performance)
CREATE INDEX IF NOT EXISTS idx_ordini_tenant_id ON ordini(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordini_stato ON ordini(stato);
CREATE INDEX IF NOT EXISTS idx_ordini_created_at ON ordini(created_at);

-- Prodotti / Ingredienti
CREATE INDEX IF NOT EXISTS idx_prodotti_tenant_id ON prodotti(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredienti_tenant_id ON ingredienti(tenant_id);

-- ============================================
-- RLS (Row Level Security) – esempio
-- Sblocca RLS sulle tabelle e crea policy per tenant
-- ============================================

-- Abilita RLS (esempio su ordini)
-- ALTER TABLE ordini ENABLE ROW LEVEL SECURITY;

-- Policy: utenti vedono solo i dati del proprio tenant
-- (Supabase usa auth.uid(); il tuo backend inietta tenant_id dal JWT)
-- CREATE POLICY "Isolate by tenant" ON ordini
--   FOR ALL
--   USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Nota: con backend Node/Nest che fa le query, spesso RLS non è usato e l’isolamento
-- è garantito dal middleware che inietta sempre tenantId nelle query.
-- Se usi Supabase Client dal frontend, abilita RLS e imposta app.current_tenant_id.
