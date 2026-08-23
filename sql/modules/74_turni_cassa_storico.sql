-- Modulo 74 — Storico turni cassa.
-- Il sistema turni cassa (public.turni_operatori + turni_cassa_apri/chiudi/aperto) esiste già
-- completo: parametro tenant (cassa_turno_obbligatorio), gate checkout, ordine collegato al
-- turno. Mancava però un modo per rivedere lo STORICO dei turni passati (chi ha aperto quando,
-- con quale scostamento in chiusura) — turni_cassa_aperto mostra solo il turno APERTO adesso,
-- nessuna RPC restituiva l'elenco storico per la revisione/contabilità.
--
-- Applicato in produzione via apply_migration il 2026-08-23.

CREATE OR REPLACE FUNCTION public.turni_cassa_storico(
  p_tenant_id uuid,
  p_punto_vendita_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 60
)
RETURNS TABLE (
  id integer,
  user_id uuid,
  operatore text,
  punto_vendita_id uuid,
  punto_vendita_nome text,
  stato text,
  aperto_il timestamptz,
  chiuso_il timestamptz,
  fondo_contato_euro numeric,
  incasso_atteso_euro numeric,
  delta_euro numeric,
  note_chiusura text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    COALESCE(
      NULLIF(trim((SELECT ur.nome_visualizzato FROM public.utenti_ruoli ur
                    WHERE ur.user_id = t.user_id AND ur.tenant_id = t.tenant_id
                    ORDER BY ur.created_at DESC LIMIT 1)), ''),
      (SELECT u.email FROM auth.users u WHERE u.id = t.user_id),
      t.user_id::text
    ) AS operatore,
    t.punto_vendita_id,
    pv.nome,
    t.stato,
    t.aperto_il,
    t.chiuso_il,
    t.fondo_contato_euro,
    t.incasso_atteso_euro,
    t.delta_euro,
    t.note_chiusura
  FROM public.turni_operatori t
  LEFT JOIN public.punti_vendita pv ON pv.id = t.punto_vendita_id
  WHERE t.tenant_id = p_tenant_id
    AND (p_punto_vendita_id IS NULL OR t.punto_vendita_id = p_punto_vendita_id)
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(200, COALESCE(p_limit, 60)));
END;
$function$;

REVOKE ALL ON FUNCTION public.turni_cassa_storico(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turni_cassa_storico(uuid, uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.turni_cassa_storico(uuid, uuid, integer) IS
  'Storico turni cassa (aperti e chiusi) del tenant, con operatore e scostamento in chiusura, per revisione/contabilità.';
