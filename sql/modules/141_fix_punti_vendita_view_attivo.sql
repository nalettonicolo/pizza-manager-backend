-- Modulo 141 — Fix: vista public.punti_vendita non controllava `attivo`
--
-- Sia il ramo superadmin sia il ramo staff/cliente della vista (modulo 33) non filtravano per
-- utenti_ruoli.attivo: un account con ruolo superadmin disattivato (es. ex dipendente, account
-- sospeso) manteneva comunque la vista completa di TUTTI i punti vendita di TUTTI i tenant; un
-- dipendente disattivato di un tenant manteneva comunque la vista dei punti vendita del proprio
-- tenant. Il pattern usato ovunque nel resto del codice (COALESCE(attivo, true) = true) qui era
-- stato omesso per svista.

-- La vista è security_invoker=true (modulo 27): l'opzione va ripetuta esplicitamente, altrimenti
-- CREATE OR REPLACE la resetta al default (bypasserebbe la RLS di core.punti_vendita — una
-- regressione peggiore del bug che stiamo correggendo).
CREATE OR REPLACE VIEW public.punti_vendita
WITH (security_invoker = true) AS
SELECT id, tenant_id, nome, slug, attivo, consegna_area_poligono, lat, lng, created_at, updated_at
FROM core.punti_vendita pv
WHERE (
  EXISTS (
    SELECT 1 FROM utenti_ruoli sa
    WHERE sa.user_id = auth.uid()
      AND COALESCE(sa.attivo, true) = true
      AND lower(trim(COALESCE(sa.ruolo, ''))) = ANY (ARRAY['superadmin', 'super_admin'])
  )
)
OR (
  tenant_id IN (
    SELECT utenti_ruoli.tenant_id FROM utenti_ruoli
    WHERE utenti_ruoli.user_id = auth.uid()
      AND COALESCE(utenti_ruoli.attivo, true) = true
    UNION
    SELECT clienti.tenant_id FROM clienti
    WHERE clienti.id = auth.uid()
  )
);
