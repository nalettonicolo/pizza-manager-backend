-- Modulo 143 — Fix: policy SELECT su public.clienti non controllava utenti_ruoli.attivo
--
-- Audit di sicurezza (workflow OWASP, verifica avversariale con esito confermato): a differenza
-- di ogni altra policy/funzione del progetto (pattern COALESCE(ur.attivo, true) = true usato
-- sistematicamente), il ramo "staff" della policy SELECT su public.clienti (modulo 68,
-- clienti_select_staff_tenant) concedeva l'accesso a QUALSIASI riga in utenti_ruoli per il
-- tenant, anche disattivata. Un dipendente disattivato con un JWT ancora valido (il
-- refresh/access token non viene invalidato alla disattivazione) poteva continuare a leggere
-- nome/telefono/indirizzo di tutti i clienti del locale via REST/PostgREST, bypassando la revoca
-- dell'accesso operativo.
--
-- Non toccata la policy separata clienti_select_own (id = auth.uid(), il cliente vede il proprio
-- profilo) né i rami tenant_admins/pm_auth_is_superadmin() di questa stessa policy, entrambi già
-- corretti (tenant_admins non ha flag attivo: la riga stessa è la prova di appartenenza attiva;
-- pm_auth_is_superadmin() controlla già COALESCE(ur.attivo, true) IS DISTINCT FROM false).

DROP POLICY IF EXISTS clienti_select_staff_tenant ON public.clienti;

CREATE POLICY clienti_select_staff_tenant ON public.clienti
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = clienti.tenant_id
        AND COALESCE(ur.attivo, true) = true
    )
    OR EXISTS (
      SELECT 1 FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid() AND ta.tenant_id = clienti.tenant_id
    )
    OR public.pm_auth_is_superadmin()
  );
