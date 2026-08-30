-- Modulo 118 — Ottimizzazione RLS: auth.uid() -> (select auth.uid()) (advisor performance)
--
-- Advisor Supabase "auth_rls_initplan": quando una policy chiama auth.uid()/auth.jwt() direttamente,
-- Postgres la ri-valuta per OGNI riga. Avvolgendola in (select auth.uid()) diventa un InitPlan
-- calcolato una sola volta per statement. Semanticamente identico (auth.uid() e STABLE nello
-- statement): nessun cambiamento di accesso, solo performance su tabelle grandi.
--
-- Interessa 7 policy rilevate live (audit sicurezza/performance 2026-08). Nomi tabelle qualificati
-- con public./core. per evitare ambiguita di search_path. Idempotente: ALTER POLICY reimposta
-- l'espressione ogni volta.

-- core.carrelli_sospesi (ALL: USING + WITH CHECK)
ALTER POLICY carrelli_sospesi_tenant_staff_or_cliente ON core.carrelli_sospesi
  USING (
    EXISTS (SELECT 1 FROM public.utenti_ruoli ur
            WHERE ur.user_id = (select auth.uid())
              AND ur.tenant_id = carrelli_sospesi.tenant_id
              AND COALESCE(ur.attivo, true) = true)
    OR EXISTS (SELECT 1 FROM public.clienti c
               WHERE c.id = (select auth.uid())
                 AND c.id = carrelli_sospesi.cliente_id
                 AND c.tenant_id = carrelli_sospesi.tenant_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.utenti_ruoli ur
            WHERE ur.user_id = (select auth.uid())
              AND ur.tenant_id = carrelli_sospesi.tenant_id
              AND COALESCE(ur.attivo, true) = true)
    OR EXISTS (SELECT 1 FROM public.clienti c
               WHERE c.id = (select auth.uid())
                 AND c.id = carrelli_sospesi.cliente_id
                 AND c.tenant_id = carrelli_sospesi.tenant_id)
  );

-- core.ordine_consegna_evento (INSERT: WITH CHECK)
ALTER POLICY ordine_consegna_evento_insert_staff ON core.ordine_consegna_evento
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.utenti_ruoli ur
            WHERE ur.user_id = (select auth.uid())
              AND ur.tenant_id = ordine_consegna_evento.tenant_id
              AND ur.attivo IS DISTINCT FROM false)
  );

-- public.anagrafica_clienti (INSERT: WITH CHECK)
ALTER POLICY anagrafica_clienti_staff_insert ON public.anagrafica_clienti
  WITH CHECK (
    tenant_id IN (SELECT utenti_ruoli.tenant_id FROM public.utenti_ruoli
                  WHERE utenti_ruoli.user_id = (select auth.uid()))
  );

-- public.fidelity_movimenti (INSERT: WITH CHECK)
ALTER POLICY fidelity_movimenti_staff_insert ON public.fidelity_movimenti
  WITH CHECK (
    tenant_id IN (SELECT utenti_ruoli.tenant_id FROM public.utenti_ruoli
                  WHERE utenti_ruoli.user_id = (select auth.uid()))
  );

-- public.notifiche_outbox (INSERT: WITH CHECK)
ALTER POLICY notifiche_outbox_insert_staff ON public.notifiche_outbox
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.utenti_ruoli ur
            WHERE ur.user_id = (select auth.uid())
              AND ur.tenant_id = notifiche_outbox.tenant_id
              AND ur.attivo IS DISTINCT FROM false)
  );

-- public.turni_operatori (INSERT: WITH CHECK)
ALTER POLICY turni_operatori_staff_insert ON public.turni_operatori
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur
                  WHERE ur.user_id = (select auth.uid())
                    AND COALESCE(ur.attivo, true) = true)
  );

-- public.utenti_ruoli (INSERT: WITH CHECK)
ALTER POLICY utenti_ruoli_insert_admin ON public.utenti_ruoli
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_admins a
            WHERE a.user_id = (select auth.uid())
              AND a.tenant_id = utenti_ruoli.tenant_id)
  );
