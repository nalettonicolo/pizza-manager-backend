-- Vista public."Ordine" + trigger: colonne rider (dopo 20260408120000_rider_delivery_enterprise.sql)
-- Fonte: sql/modules/04_ordine_view_trigger.sql

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = NEW.nome_cliente,
    orario_ritiro      = NEW.orario_ritiro,
    indirizzo_consegna = NEW.indirizzo_consegna,
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();
