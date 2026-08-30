-- Modulo 119 — Consolidamento policy permissive duplicate (advisor multiple_permissive_policies)
--
-- Advisor Supabase: piu policy PERMISSIVE per stessa (ruolo, azione) vengono valutate tutte (OR),
-- con costo per riga. Consolidiamo SENZA cambiare l'accesso effettivo.
--
-- Analisi (audit sicurezza/performance 2026-08):
--  * pm_core_tenant_access(tenant) ritorna true per: superadmin | staff del tenant
--    (utenti_ruoli con attivo IS NOT FALSE, identico al check "staff") | cliente del tenant |
--    rider del tenant. Quindi le policy "*_modify_staff" e "*_select_staff" (solo staff del tenant)
--    sono un SOTTOINSIEME della policy pm_core_* e sono ridondanti: eliminarle NON riduce l'accesso.
--  * public.clienti: clienti_select_tenant_admin_or_sa (admin|superadmin) e sottoinsieme di
--    clienti_select_staff_tenant (staff|admin|superadmin) -> ridondante.
--  * public.agente_conversazioni: le due policy hanno condizioni diverse (superadmin globale vs
--    supporto del proprio tenant): NON sottoinsieme -> le fondiamo in una sola policy con OR.
--
-- Nessun DROP di tabelle/colonne/dati: solo policy RLS ridondanti. Idempotente.

-- ---------- core.consegna_percorso : tieni pm_core_*, elimina staff (subset) ----------
DROP POLICY IF EXISTS consegna_percorso_modify_staff ON core.consegna_percorso;
DROP POLICY IF EXISTS consegna_percorso_select_staff ON core.consegna_percorso;

-- ---------- core.consegna_percorso_ordine ----------
DROP POLICY IF EXISTS consegna_percorso_ordine_modify_staff ON core.consegna_percorso_ordine;
DROP POLICY IF EXISTS consegna_percorso_ordine_select_staff ON core.consegna_percorso_ordine;

-- ---------- core.rider ----------
DROP POLICY IF EXISTS rider_modify_staff ON core.rider;
DROP POLICY IF EXISTS rider_select_staff ON core.rider;

-- ---------- core.rider_posizione ----------
DROP POLICY IF EXISTS rider_posizione_modify_staff ON core.rider_posizione;
DROP POLICY IF EXISTS rider_posizione_select_staff ON core.rider_posizione;

-- ---------- core.turno_rider ----------
DROP POLICY IF EXISTS turno_rider_modify_staff ON core.turno_rider;
DROP POLICY IF EXISTS turno_rider_select_staff ON core.turno_rider;

-- ---------- public.clienti : elimina la policy subset ----------
DROP POLICY IF EXISTS clienti_select_tenant_admin_or_sa ON public.clienti;

-- ---------- public.agente_conversazioni : fondi le due ALL in una sola (OR) ----------
-- Creiamo la policy unificata PRIMA di eliminare le vecchie, per non lasciare mai un buco d'accesso.
DROP POLICY IF EXISTS agente_conversazioni_access ON public.agente_conversazioni;
CREATE POLICY agente_conversazioni_access ON public.agente_conversazioni
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.utenti_ruoli ur
            WHERE ur.user_id = (select auth.uid())
              AND COALESCE(ur.attivo, true) = true
              AND lower(trim(COALESCE(ur.ruolo, ''))) = ANY (ARRAY['superadmin','super_admin']))
    OR (
      modalita = 'supporto'
      AND tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur
                        WHERE ur.user_id = (select auth.uid())
                          AND COALESCE(ur.attivo, true) = true)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.utenti_ruoli ur
            WHERE ur.user_id = (select auth.uid())
              AND COALESCE(ur.attivo, true) = true
              AND lower(trim(COALESCE(ur.ruolo, ''))) = ANY (ARRAY['superadmin','super_admin']))
    OR (
      modalita = 'supporto'
      AND tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur
                        WHERE ur.user_id = (select auth.uid())
                          AND COALESCE(ur.attivo, true) = true)
    )
  );

DROP POLICY IF EXISTS agente_conversazioni_superadmin_all ON public.agente_conversazioni;
DROP POLICY IF EXISTS agente_conversazioni_tenant_own ON public.agente_conversazioni;
