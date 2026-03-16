-- ============================================================
-- Tabelle per auth frontend: utenti_ruoli (staff) e clienti
-- Collegano auth.users (Supabase Auth) a core.tenants
-- ============================================================

-- Staff: ruoli operativi (superadmin, admin, cassa, bancone, cucina, pizzaiolo, delivery)
CREATE TABLE IF NOT EXISTS public.utenti_ruoli (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ruolo TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clienti: profilo cliente collegato a auth.users
CREATE TABLE IF NOT EXISTS public.clienti (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_utenti_ruoli_tenant ON public.utenti_ruoli(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clienti_tenant ON public.clienti(tenant_id);

-- RLS: utenti possono leggere solo il proprio profilo
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utenti_ruoli_select_own" ON public.utenti_ruoli;
CREATE POLICY "utenti_ruoli_select_own"
    ON public.utenti_ruoli FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clienti_select_own" ON public.clienti;
CREATE POLICY "clienti_select_own"
    ON public.clienti FOR SELECT
    USING (auth.uid() = id);

-- GRANT: ruolo authenticated deve poter fare SELECT (RLS filtra le righe)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.utenti_ruoli TO authenticated;
GRANT SELECT ON public.clienti TO authenticated;
