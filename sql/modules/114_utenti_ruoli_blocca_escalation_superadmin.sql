-- ============================================================================
-- 114 — Guardia anti privilege-escalation su public.utenti_ruoli
-- ----------------------------------------------------------------------------
-- Contesto (audit sicurezza): la policy `utenti_ruoli_update_admin` permette a un
-- ADMIN di tenant (riga in tenant_admins) di fare UPDATE sulle righe del proprio
-- tenant senza alcun WITH CHECK sul valore di `ruolo`. Un admin locale poteva quindi
-- impostare `ruolo = 'superadmin'` (su di sé o altri) e ottenere privilegi di
-- SUPERADMIN di piattaforma (pm_auth_is_superadmin() legge proprio utenti_ruoli.ruolo)
-- -> escalation cross-tenant. OWASP A01: Broken Access Control.
--
-- Difesa in profondità: un trigger BEFORE INSERT/UPDATE nega l'assegnazione del ruolo
-- 'superadmin'/'super_admin' se il chiamante NON è già superadmin. Il seeding
-- server-side (service_role / postgres, dove auth.uid() è NULL) resta consentito,
-- così da non rompere l'assegnazione legittima del primo superadmin via SQL/CLI.
--
-- Idempotente: CREATE OR REPLACE FUNCTION + ricreazione trigger. Solo aggiunte sicure.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.utenti_ruoli_guard_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ruolo_norm text := lower(trim(COALESCE(NEW.ruolo, '')));
BEGIN
  IF v_ruolo_norm IN ('superadmin', 'super_admin') THEN
    -- Consentito solo se:
    --  - operazione server-side privilegiata (auth.uid() IS NULL: service_role/postgres), oppure
    --  - il chiamante è GIA' superadmin.
    IF auth.uid() IS NOT NULL AND NOT public.pm_auth_is_superadmin() THEN
      RAISE EXCEPTION 'forbidden: solo un superadmin puo assegnare il ruolo superadmin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.utenti_ruoli_guard_superadmin() IS
  'Blocca l''assegnazione del ruolo superadmin da parte di chi non e'' gia'' superadmin (anti privilege-escalation, audit sicurezza 2026-08).';

DROP TRIGGER IF EXISTS trg_utenti_ruoli_guard_superadmin ON public.utenti_ruoli;
CREATE TRIGGER trg_utenti_ruoli_guard_superadmin
  BEFORE INSERT OR UPDATE ON public.utenti_ruoli
  FOR EACH ROW
  EXECUTE FUNCTION public.utenti_ruoli_guard_superadmin();
