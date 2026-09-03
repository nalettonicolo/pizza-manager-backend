-- Modulo 138 — Fix di sicurezza: scrittura su public."Ordine" riservata allo staff
--
-- Audit di sicurezza (2026-08-30): la vista public."Ordine" (security_invoker=true, usata da
-- adminService.js/superadminService.js per lo staff) concedeva GRANT UPDATE/INSERT/DELETE al
-- ruolo `authenticated` — cioè a QUALSIASI cliente registrato o rider, non solo allo staff.
--
-- Il gate reale per UPDATE è dentro ordine_instead_of_update() (SECURITY DEFINER, bypassa la RLS
-- della tabella): il WHERE controllava solo "il chiamante appartiene allo stesso tenant"
-- (utenti_ruoli OPPURE clienti OPPURE core.rider), mai la proprietà dell'ordine. Per INSERT/DELETE
-- (nessun trigger INSTEAD OF: la vista è "auto-updatable" e scrive direttamente su core.ordini) il
-- gate era la RLS della tabella, con la stessa policy `pm_core_ordini_auth_tenant` per TUTTI i
-- comandi, basata sulla stessa appartenenza-tenant larga (pm_core_tenant_access).
--
-- Risultato pre-fix: un cliente registrato sulla vetrina di un tenant poteva, con una singola
-- chiamata REST verso /rest/v1/Ordine, modificare (totale, indirizzo, stato...) o cancellare
-- fisicamente l'ordine di UN ALTRO cliente dello stesso locale, o inserire un ordine bypassando
-- tutti i controlli anti-frode di create_order_with_items.
--
-- Fix: scrittura (INSERT/UPDATE/DELETE) su core.ordini via questa vista riservata a chi ha un
-- ruolo staff attivo su quel tenant (utenti_ruoli) o è superadmin — mai a clienti/rider, che
-- devono passare dalle RPC dedicate (create_order_with_items, delivery_update_stato_consegna,
-- ecc.), le uniche con i controlli di business corretti. La lettura (SELECT) resta invariata.

CREATE OR REPLACE FUNCTION public.pm_core_staff_tenant_access(p_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'core'
AS $function$
BEGIN
  IF p_tenant IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) IS NOT FALSE
      AND ur.tenant_id = p_tenant
  );
END;
$function$;

COMMENT ON FUNCTION public.pm_core_staff_tenant_access(uuid) IS
  'Solo staff (utenti_ruoli attivo) o superadmin — a differenza di pm_core_tenant_access() NON include clienti/rider. Usata per gating di scrittura su core.ordini via la vista Ordine.';

REVOKE ALL ON FUNCTION public.pm_core_staff_tenant_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_core_staff_tenant_access(uuid) TO authenticated;

-- Trigger INSTEAD OF UPDATE: era il gate reale per UPDATE (bypassa la RLS della tabella in
-- quanto SECURITY DEFINER) — ora richiede staff/superadmin, non più "qualsiasi appartenente al
-- tenant".
CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
BEGIN
  UPDATE core.ordini
  SET
    stato               = COALESCE(NEW.stato, OLD.stato),
    totale              = COALESCE(NEW.totale, OLD.totale),
    note                = COALESCE(NEW.note, OLD.note),
    tipo_pagamento      = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine         = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente        = COALESCE(NEW.nome_cliente, OLD.nome_cliente),
    telefono_ritiro     = COALESCE(NEW.telefono_ritiro, OLD.telefono_ritiro),
    orario_ritiro       = COALESCE(NEW.orario_ritiro, OLD.orario_ritiro),
    indirizzo_consegna  = COALESCE(NEW.indirizzo_consegna, OLD.indirizzo_consegna),
    consegna_lng        = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat        = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna      = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id    = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id  = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id            = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id      = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id  = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery      = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at  = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    cucina_prep_stato   = COALESCE(NEW.cucina_prep_stato, OLD.cucina_prep_stato),
    richiede_accettazione_cassa = COALESCE(NEW.richiede_accettazione_cassa, OLD.richiede_accettazione_cassa),
    updated_at          = now()
  WHERE id = OLD.id
    AND public.pm_core_staff_tenant_access(tenant_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'non_autorizzato' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- RLS core.ordini: separa SELECT (invariato, resta ampio: staff/clienti/rider nel proprio
-- tenant) da INSERT/UPDATE/DELETE (ora solo staff/superadmin) — gate reale per INSERT/DELETE via
-- la vista, dato che non hanno trigger INSTEAD OF (vista "auto-updatable" su security_invoker).
DROP POLICY IF EXISTS pm_core_ordini_auth_tenant ON core.ordini;

CREATE POLICY pm_core_ordini_select ON core.ordini
  FOR SELECT
  TO authenticated
  USING (public.pm_core_tenant_access(tenant_id));

CREATE POLICY pm_core_ordini_staff_write ON core.ordini
  FOR INSERT
  TO authenticated
  WITH CHECK (public.pm_core_staff_tenant_access(tenant_id));

CREATE POLICY pm_core_ordini_staff_update ON core.ordini
  FOR UPDATE
  TO authenticated
  USING (public.pm_core_staff_tenant_access(tenant_id))
  WITH CHECK (public.pm_core_staff_tenant_access(tenant_id));

CREATE POLICY pm_core_ordini_staff_delete ON core.ordini
  FOR DELETE
  TO authenticated
  USING (public.pm_core_staff_tenant_access(tenant_id));
