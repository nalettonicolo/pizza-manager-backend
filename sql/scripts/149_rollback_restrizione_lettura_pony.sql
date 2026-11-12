-- Rollback del modulo 149 (restrizione lettura pony + allineamento stato_consegna)
-- BOZZA, NON ESEGUITA. Da lanciare a mano solo se il modulo 149 e' stato applicato.
--
-- Cosa riporta indietro:
--  * pm_core_ordini_select torna all'espressione salvata dal modulo in public.pm_modulo_backup_policy
--    (se manca: usa quella del modulo 138, pm_core_tenant_access(tenant_id));
--  * toglie la policy restrictive su core.rider;
--  * toglie il trigger di allineamento e ripristina i testi originali di stato_consegna,
--    ma SOLO sulle righe non cambiate dopo il modulo (le altre restano com'erano).
--
-- Cosa NON tocca (nessun dato cancellato): la colonna core.ordini.stato_consegna_pre149 e la tabella
-- public.pm_modulo_backup_policy restano. Si possono togliere a mano, solo se Nicolo' lo chiede.
-- Le funzioni helper e la policy restrictive sono oggetti creati dal modulo 149: il rollback li
-- elimina (DROP) perche' non contengono dati.

BEGIN;

-- 1) Policy ordini: ripristino dell'espressione originale.
DO $$
DECLARE
  v_expr text;
BEGIN
  SELECT b.using_expr INTO v_expr
  FROM public.pm_modulo_backup_policy b
  WHERE b.modulo = '149' AND b.tabella = 'core.ordini' AND b.policy = 'pm_core_ordini_select'
  ORDER BY b.creata_il
  LIMIT 1;

  IF v_expr IS NULL THEN
    RAISE NOTICE 'Backup non trovato: uso l''espressione del modulo 138.';
    v_expr := 'public.pm_core_tenant_access(tenant_id)';
  END IF;

  EXECUTE format('ALTER POLICY pm_core_ordini_select ON core.ordini USING (%s)', v_expr);
END $$;

-- 2) Policy rider.
DROP POLICY IF EXISTS pm_core_rider_select_pony_limitato ON core.rider;

-- 3) Trigger stato_consegna e ripristino dei testi originali (solo righe ancora com'erano dopo il backfill).
DROP TRIGGER IF EXISTS tr_ordini_stato_consegna_allinea ON core.ordini;

UPDATE core.ordini o
SET stato_consegna = o.stato_consegna_pre149
WHERE o.stato_consegna_pre149 IS NOT NULL
  AND o.stato_consegna IS NOT DISTINCT FROM public.pm_stato_consegna_normalizza(o.stato_consegna_pre149);

-- 4) Funzioni create dal modulo (ormai non usate da policy o trigger).
DROP FUNCTION IF EXISTS public.pm_ordini_stato_consegna_allinea();
DROP FUNCTION IF EXISTS public.pm_stato_consegna_normalizza(text);
DROP FUNCTION IF EXISTS public.pm_core_is_pony_only(uuid);

COMMIT;
