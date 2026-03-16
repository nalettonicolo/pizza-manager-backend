-- Inserisce/aggiorna la riga in public.utenti_ruoli per l'utente superadmin
-- UID superadmin: 0683a615-d08a-488d-b9df-3a486b35a461
-- Esegui in Supabase SQL Editor (come utente con permessi su public.utenti_ruoli e core.tenants).
-- Richiede almeno un tenant in core.tenants (altrimenti creane uno prima).

-- 1) Se la tabella ha user_id come PRIMARY KEY (migrazione auth):
INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id, attivo)
VALUES (
  '0683a615-d08a-488d-b9df-3a486b35a461'::uuid,
  'superadmin',
  (SELECT id FROM core.tenants ORDER BY created_at NULLS LAST LIMIT 1),
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  ruolo = EXCLUDED.ruolo,
  tenant_id = EXCLUDED.tenant_id,
  attivo = true;

-- 2) Se l'INSERT fallisce (es. vincolo su tenant_id o tabella diversa), prova solo UPDATE:
-- UPDATE public.utenti_ruoli
-- SET ruolo = 'superadmin', attivo = true
-- WHERE user_id = '0683a615-d08a-488d-b9df-3a486b35a461';

-- Verifica
SELECT user_id, ruolo, tenant_id, attivo
FROM public.utenti_ruoli
WHERE user_id = '0683a615-d08a-488d-b9df-3a486b35a461';
