-- Modulo 149 — Restrizione lettura ordini/rider per il pony + allineamento stato_consegna
--
-- BOZZA, NON APPLICATA. NON RILASCIARE PRIMA DELLA PROVA CON ACCOUNT PONY VERO.
-- (Prova con account pony vero: vedi sql/scripts/149_verifica_restrizione_lettura_pony.sql)
--
-- Rollback:  sql/scripts/149_rollback_restrizione_lettura_pony.sql
-- Verifica:  sql/scripts/149_verifica_restrizione_lettura_pony.sql
--
-- NUMERAZIONE: nel repo l'ultimo modulo e' il 146. Se i moduli 147/148 sono gia' in produzione
-- (commit locale non ancora pushato) il numero 149 evita la collisione. Da confermare prima del rilascio.
--
-- ---------------------------------------------------------------------------------------------
-- PROBLEMA
-- Il modulo 138 ha lasciato core.ordini.pm_core_ordini_select = pm_core_tenant_access(tenant_id):
-- vera per superadmin, staff, clienti e rider del tenant. Un pony (utenti_ruoli.ruolo = 'pony',
-- oppure account rider in core.rider) legge quindi TUTTI gli ordini del locale (nome, telefono,
-- indirizzo, totale, note) e tutti i rider (telefono, note).
--
-- DECISIONE (Nicolo', 12/11/2026): il pony legge solo gli ordini assegnati a lui e quelli ancora
-- da assegnare del suo tenant.
--
-- COSA FA QUESTO MODULO
-- 1) public.pm_core_is_pony_only(tenant): true se il chiamante e' SOLO pony sul tenant
--    (tutti i suoi ruoli attivi sul tenant sono 'pony', oppure non ha ruoli staff ma ha una riga
--    core.rider attiva). Superadmin e staff NON sono pony-only. Non guarda le colonne accesso_*:
--    per i ruoli di reparto la UI le ignora (src/utils/operativeAreaAccess.js) e hanno DEFAULT true.
--    Il ruolo 'delivery' NON e' ristretto: la pagina /operative/delivery mostra tutte le consegne.
-- 2) pm_core_ordini_select (ALTER POLICY, nessun DROP): predicato precedente AND (non pony-only
--    OR ordine mio OR ordine libero). Per chi non e' pony il comportamento e' identico a prima.
--    L'espressione precedente viene salvata in public.pm_modulo_backup_policy per il rollback.
-- 3) core.rider: policy RESTRICTIVE in SELECT: il pony legge solo la propria riga.
--    (policy permissive esistente non toccata; rollback = DROP della sola policy nuova)
-- 4) stato_consegna (TEXT) allineato a core.stato_delivery SENZA aggiungere stati e SENZA
--    cambiare il tipo della colonna (le RPC delivery_* scrivono testo: un cambio di tipo le
--    romperebbe). Backfill: RICHIESTA->DA_ASSEGNARE, PROBLEMA->ANOMALIA, vuoto->NULL, trim+maiuscolo;
--    un valore sconosciuto prende stato_delivery se presente, altrimenti NULL. Il valore originale
--    resta in core.ordini.stato_consegna_pre149 (nessun dato perso). Un trigger fa lo stesso sulle
--    scritture future (RPC, vista Ordine, backend Nest, app) e rifiuta valori fuori dal tipo.
--
-- DEFINIZIONE DI "ORDINE LIBERO" (scelta da confermare)
-- La richiesta diceva "stato DA_ASSEGNARE". Nel codice pero':
--  * il tasto verde del Bancone (Bancone.jsx:429) imposta stato_consegna = ASSEGNATO lasciando
--    rider_id vuoto: l'ordine e' "pronto per il pony" e il pony lo prende con IN_VIAGGIO;
--  * create_order_with_items non valorizza stato_delivery: un ordine nuovo ha stato_delivery NULL.
-- Con la regola letterale il pony non vedrebbe piu' gli ordini che deve prendere (il rischio
-- indicato nel piano). Quindi "libero" = delivery, senza rider, non cancellato, non annullato/
-- consegnato, con stato logistico DA_ASSEGNARE, ASSEGNATO oppure non ancora valorizzato
-- (NULL = DA_ASSEGNARE, come nel backfill dello schema). Per la regola letterale cambiare la riga
-- marcata "[SCELTA LIBERO]" in:  ... IN ('DA_ASSEGNARE')
--
-- Nessun DROP/DELETE di dati. Idempotente. Da applicare a mano da Nicolo' (SQL editor Supabase).

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1) Helper: il chiamante e' solo pony su questo tenant?
-- SECURITY DEFINER per non ricorsare nella RLS di core.rider (la policy del punto 3 la richiama).
-- Rivela solo un booleano sul chiamante stesso.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_core_is_pony_only(p_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
BEGIN
  IF p_tenant IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Superadmin: mai ristretto.
  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) THEN
    RETURN false;
  END IF;

  -- Ha ruoli attivi sul tenant: ristretto solo se TUTTI sono 'pony'.
  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) IS NOT FALSE
      AND ur.tenant_id = p_tenant
  ) THEN
    RETURN NOT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur2
      WHERE ur2.user_id = auth.uid()
        AND COALESCE(ur2.attivo, true) IS NOT FALSE
        AND ur2.tenant_id = p_tenant
        AND lower(trim(COALESCE(ur2.ruolo, ''))) <> 'pony'
    );
  END IF;

  -- Nessun ruolo staff: account rider "puro" (core.rider.auth_user_id).
  RETURN EXISTS (
    SELECT 1
    FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND rr.tenant_id = p_tenant
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );
END;
$function$;

COMMENT ON FUNCTION public.pm_core_is_pony_only(uuid) IS
  'True se auth.uid() e'' solo pony (ruolo pony o rider puro) sul tenant: usata dalle policy di lettura ordini/rider (modulo 149). Superadmin e staff: false.';

REVOKE ALL ON FUNCTION public.pm_core_is_pony_only(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_core_is_pony_only(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2) Backup dell'espressione attuale di pm_core_ordini_select (per un rollback esatto)
--    Tabella interna: RLS attiva e nessuna policy => non leggibile da anon/authenticated.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pm_modulo_backup_policy (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modulo      text        NOT NULL,
  tabella     text        NOT NULL,
  policy      text        NOT NULL,
  using_expr  text,
  creata_il   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_modulo_backup_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pm_modulo_backup_policy FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.pm_modulo_backup_policy IS
  'Espressioni USING originali delle policy modificate da un modulo SQL, per il rollback. Solo uso interno.';

INSERT INTO public.pm_modulo_backup_policy (modulo, tabella, policy, using_expr)
SELECT '149', 'core.ordini', p.polname, pg_get_expr(p.polqual, p.polrelid)
FROM pg_policy p
WHERE p.polrelid = 'core.ordini'::regclass
  AND p.polname = 'pm_core_ordini_select'
  AND NOT EXISTS (
    SELECT 1 FROM public.pm_modulo_backup_policy b
    WHERE b.modulo = '149' AND b.tabella = 'core.ordini' AND b.policy = 'pm_core_ordini_select'
  );

-- ---------------------------------------------------------------------------------------------
-- 3) Lettura ordini: il pony vede solo i propri e quelli liberi del suo tenant
--    Non-pony: identico al modulo 138 (pm_core_tenant_access).
-- ---------------------------------------------------------------------------------------------
ALTER POLICY pm_core_ordini_select ON core.ordini
  USING (
    public.pm_core_tenant_access(tenant_id)
    AND (
      NOT public.pm_core_is_pony_only(tenant_id)
      -- ordine assegnato a me (la sotto-query non e' correlata: valutata una volta sola)
      OR rider_id IN (
        SELECT rr.id
        FROM core.rider rr
        WHERE rr.auth_user_id = auth.uid()
          AND rr.deleted_at IS NULL
      )
      -- ordine libero del tenant
      OR (
        rider_id IS NULL
        AND deleted_at IS NULL
        AND lower(trim(COALESCE(tipo_ordine, ''))) IN ('delivery', 'consegna')
        AND stato::text NOT IN ('ANNULLATO', 'CONSEGNATO')
        -- [SCELTA LIBERO] letterale = IN ('DA_ASSEGNARE'); qui anche ASSEGNATO senza rider (Bancone)
        AND COALESCE(stato_delivery::text, NULLIF(upper(btrim(COALESCE(stato_consegna, ''))), ''), 'DA_ASSEGNARE')
            IN ('DA_ASSEGNARE', 'ASSEGNATO')
      )
    )
  );

-- ---------------------------------------------------------------------------------------------
-- 4) Lettura rider: il pony legge solo la propria riga (policy RESTRICTIVE = in AND con le altre)
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('core.rider') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'core' AND tablename = 'rider'
         AND policyname = 'pm_core_rider_select_pony_limitato'
     ) THEN
    CREATE POLICY pm_core_rider_select_pony_limitato ON core.rider
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated
      USING (
        NOT public.pm_core_is_pony_only(tenant_id)
        OR auth_user_id = auth.uid()
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5) stato_consegna (TEXT) allineato a core.stato_delivery, senza nuovi stati
-- ---------------------------------------------------------------------------------------------
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS stato_consegna_pre149 text;
COMMENT ON COLUMN core.ordini.stato_consegna_pre149 IS
  'Valore originale di stato_consegna prima del modulo 149 (solo righe modificate dal backfill). Per rollback/audit.';

-- Restituisce l'etichetta di core.stato_delivery corrispondente, oppure NULL se vuoto o sconosciuto.
CREATE OR REPLACE FUNCTION public.pm_stato_consegna_normalizza(p_stato text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'core'
AS $function$
  SELECT CASE
    WHEN NULLIF(upper(btrim(COALESCE(p_stato, ''))), '') IS NULL THEN NULL
    WHEN upper(btrim(p_stato)) = 'RICHIESTA' THEN 'DA_ASSEGNARE'
    WHEN upper(btrim(p_stato)) = 'PROBLEMA'  THEN 'ANOMALIA'
    WHEN upper(btrim(p_stato)) = ANY (enum_range(NULL::core.stato_delivery)::text[]) THEN upper(btrim(p_stato))
    ELSE NULL
  END
$function$;

COMMENT ON FUNCTION public.pm_stato_consegna_normalizza(text) IS
  'Mappa il testo legacy di stato_consegna su un valore di core.stato_delivery (RICHIESTA->DA_ASSEGNARE, PROBLEMA->ANOMALIA). NULL se vuoto o sconosciuto.';

-- Backfill: i valori originali delle righe cambiate restano in stato_consegna_pre149.
UPDATE core.ordini o
SET stato_consegna_pre149 = COALESCE(o.stato_consegna_pre149, o.stato_consegna),
    stato_consegna        = n.nuovo
FROM (
  SELECT x.id,
         CASE
           WHEN NULLIF(btrim(COALESCE(x.stato_consegna, '')), '') IS NULL THEN NULL
           ELSE COALESCE(public.pm_stato_consegna_normalizza(x.stato_consegna), x.stato_delivery::text)
         END AS nuovo
  FROM core.ordini x
) n
WHERE n.id = o.id
  AND o.stato_consegna IS DISTINCT FROM n.nuovo;

-- Trigger per le scritture future (creato DOPO il backfill, cosi' non scatta su righe legacy).
CREATE OR REPLACE FUNCTION public.pm_ordini_stato_consegna_allinea()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v text;
BEGIN
  IF NEW.stato_consegna IS NULL OR btrim(NEW.stato_consegna) = '' THEN
    NEW.stato_consegna := NULL;
    RETURN NEW;
  END IF;

  v := public.pm_stato_consegna_normalizza(NEW.stato_consegna);
  IF v IS NULL THEN
    RAISE EXCEPTION 'stato_consegna_non_valido' USING ERRCODE = '22023',
      DETAIL = 'Valore ricevuto: ' || NEW.stato_consegna,
      HINT = 'Valori ammessi: ' || array_to_string(enum_range(NULL::core.stato_delivery)::text[], ', ');
  END IF;

  NEW.stato_consegna := v;
  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'core.ordini'::regclass AND tgname = 'tr_ordini_stato_consegna_allinea'
  ) THEN
    CREATE TRIGGER tr_ordini_stato_consegna_allinea
      BEFORE INSERT OR UPDATE OF stato_consegna ON core.ordini
      FOR EACH ROW
      EXECUTE FUNCTION public.pm_ordini_stato_consegna_allinea();
  END IF;
END $$;

COMMIT;
