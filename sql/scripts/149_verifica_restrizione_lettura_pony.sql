-- Verifica del modulo 149 (SOLO LETTURA: ogni blocco termina con ROLLBACK, niente viene modificato)
-- Da eseguire dopo il modulo, prima su un branch/copia e poi sul progetto, da Nicolo'.
-- Sostituire a mano i segnaposto:
--   <UUID_PONY>   = auth.users.id dell'account pony vero (ruolo 'pony' in utenti_ruoli, riga in core.rider)
--   <UUID_STAFF>  = auth.users.id di un account cassa/admin dello stesso tenant
--   <UUID_TENANT> = core.tenants.id del tenant di prova

-- ===== A) Controlli strutturali (come postgres/service role) =====
-- A1. La policy contiene la nuova condizione. Atteso: 1 riga, usa_pony_only = true.
SELECT polname,
       pg_get_expr(polqual, polrelid) ILIKE '%pm_core_is_pony_only%' AS usa_pony_only
FROM pg_policy
WHERE polrelid = 'core.ordini'::regclass AND polname = 'pm_core_ordini_select';

-- A2. Policy restrictive sui rider. Atteso: 1 riga, permissive = 'RESTRICTIVE'.
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'core' AND tablename = 'rider' AND policyname = 'pm_core_rider_select_pony_limitato';

-- A3. Righe con stato_consegna fuori dal tipo core.stato_delivery. Atteso: 0 righe.
SELECT stato_consegna, count(*) AS n
FROM core.ordini
WHERE stato_consegna IS NOT NULL
  AND stato_consegna <> ALL (enum_range(NULL::core.stato_delivery)::text[])
GROUP BY 1;

-- A4. Distribuzione dopo il backfill e righe cambiate (per confronto con la situazione precedente).
SELECT stato_consegna, count(*) AS n FROM core.ordini GROUP BY 1 ORDER BY 2 DESC;
SELECT stato_consegna_pre149 AS prima, stato_consegna AS dopo, count(*) AS n
FROM core.ordini
WHERE stato_consegna_pre149 IS NOT NULL
GROUP BY 1, 2 ORDER BY 3 DESC;

-- A5. Il trigger esiste. Atteso: 1 riga.
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'core.ordini'::regclass AND tgname = 'tr_ordini_stato_consegna_allinea';

-- ===== B) Vista del pony (account vero) =====
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', '<UUID_PONY>', 'role', 'authenticated')::text, true);

-- B1. Atteso: true.
SELECT public.pm_core_is_pony_only('<UUID_TENANT>') AS sono_pony_only;

-- B2. Ordini visibili. Atteso: ordini_di_altri = 0; miei + liberi = totale.
SELECT count(*) AS totale_visibili,
       count(*) FILTER (WHERE rider_id IN (SELECT id FROM core.rider WHERE auth_user_id = auth.uid())) AS miei,
       count(*) FILTER (WHERE rider_id IS NULL) AS liberi,
       count(*) FILTER (WHERE rider_id IS NOT NULL
                          AND rider_id NOT IN (SELECT id FROM core.rider WHERE auth_user_id = auth.uid())) AS ordini_di_altri
FROM core.ordini;

-- B3. Gli ordini liberi sono solo delivery in stato da assegnare. Atteso: 0 righe.
SELECT id, numero, tipo_ordine, stato::text AS stato, stato_delivery::text AS stato_delivery, stato_consegna
FROM core.ordini
WHERE rider_id IS NULL
  AND (lower(trim(COALESCE(tipo_ordine, ''))) NOT IN ('delivery', 'consegna')
       OR COALESCE(stato_delivery::text, 'DA_ASSEGNARE') NOT IN ('DA_ASSEGNARE', 'ASSEGNATO'));

-- B4. Rider visibili. Atteso: 1 (solo se stesso).
SELECT count(*) AS rider_visibili FROM core.rider;

-- B5. L'ordine "libero" visibile e' quello che il pony puo' prendere (con la RPC, non qui).
ROLLBACK;

-- ===== C) Vista dello staff (nessuna regressione) =====
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', '<UUID_STAFF>', 'role', 'authenticated')::text, true);

-- C1. Atteso: false.
SELECT public.pm_core_is_pony_only('<UUID_TENANT>') AS staff_pony_only;

-- C2. Atteso: stesso numero della query C3 (staff vede tutto il tenant, come prima).
SELECT count(*) AS ordini_visibili_staff FROM core.ordini WHERE tenant_id = '<UUID_TENANT>';
SELECT count(*) AS rider_visibili_staff FROM core.rider WHERE tenant_id = '<UUID_TENANT>';
ROLLBACK;

-- C3. Riferimento (come postgres/service role, fuori da ogni ruolo).
SELECT (SELECT count(*) FROM core.ordini WHERE tenant_id = '<UUID_TENANT>') AS ordini_tenant,
       (SELECT count(*) FROM core.rider  WHERE tenant_id = '<UUID_TENANT>') AS rider_tenant;

-- ===== D) Prova funzionale nell'app (a mano, account pony vero) =====
-- 1. Il pony apre /operative/pony: vede solo consegne libere e proprie.
-- 2. Dal Bancone (altro account) un ordine a domicilio passa a ASSEGNATO: compare al pony entro il refresh.
-- 3. Il pony preme "In viaggio": l'ordine resta visibile (ora e' suo).
-- 4. Il pony preme "Consegnato": l'ordine esce dalla lista; la cassa lo vede nelle consegne odierne.
-- 5. Con un altro pony: l'ordine del primo non compare.
-- 6. Cambio stato "Problema" dall'app: stato_consegna diventa ANOMALIA e non ci sono errori.
