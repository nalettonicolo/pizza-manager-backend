-- ============================================================================
-- 115 — Integrità economica degli ordini creati da CLIENTE WEB
-- ----------------------------------------------------------------------------
-- Contesto (audit sicurezza): create_order_with_items memorizza `p_totale` e i
-- `prezzo` di riga così come arrivano dal client. Un cliente web registrato può
-- chiamare direttamente l'RPC (o manomettere il frontend) e creare un ordine con
-- totale arbitrario (es. €0,01), pagandolo poi online (Stripe/SumUp usano il
-- totale dell'ordine). OWASP A08/A04: manomissione dell'integrità di business.
--
-- Il ricalcolo esatto lato server non è possibile col payload attuale (gli extra
-- strutturati — formato, ingredienti, impasto — non vengono inviati all'RPC, solo
-- il prezzo già calcolato e un testo riassuntivo). Però il carrello vetrina calcola
-- il totale ESATTAMENTE come somma(prezzo_riga × quantità), senza sconti né costi
-- di consegna. Possiamo quindi imporre in modo sicuro questa invariante.
--
-- Scelta implementativa: un CONSTRAINT TRIGGER DIFFERITO su core.ordini che scatta
-- a fine transazione (quando le righe in core.riga_ordine esistono già), SOLO per
-- ordini creati da un cliente web (auth.uid() è un cliente del tenant). Lo staff di
-- cassa (prezzi custom, sconti, note) NON è toccato. Questo evita di riscrivere la
-- funzione critica create_order_with_items (~200 righe) col rischio di bloccare
-- tutti gli ordini: la protezione è additiva e disaccoppiata.
--
-- Fail-open sicuro: se auth.uid() non è disponibile a commit, il trigger non blocca
-- (non rompe ordini legittimi) — la protezione riguarda esclusivamente il caso
-- "cliente web autenticato con totale incoerente".
--
-- Idempotente: CREATE OR REPLACE FUNCTION + ricreazione trigger. Solo aggiunte.
-- ============================================================================

CREATE OR REPLACE FUNCTION core.web_ordine_totale_integrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public, pg_temp
AS $$
DECLARE
  v_is_web_cliente boolean;
  v_sum numeric;
BEGIN
  -- Applica il controllo solo agli ordini creati da un CLIENTE WEB del tenant.
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.tenant_id = NEW.tenant_id
  ) INTO v_is_web_cliente;

  IF NOT COALESCE(v_is_web_cliente, false) THEN
    RETURN NULL;  -- staff/cassa: nessun vincolo aggiuntivo
  END IF;

  IF COALESCE(NEW.totale, 0) <= 0 THEN
    RAISE EXCEPTION 'totale_non_valido' USING ERRCODE = '23514';
  END IF;

  -- Nessuna riga con prezzo negativo.
  IF EXISTS (
    SELECT 1 FROM core.riga_ordine ro
    WHERE ro.ordine_id = NEW.id AND ro.prezzo < 0
  ) THEN
    RAISE EXCEPTION 'prezzo_riga_negativo' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(sum(ro.prezzo * ro.quantita), 0)
    INTO v_sum
  FROM core.riga_ordine ro
  WHERE ro.ordine_id = NEW.id;

  -- Il totale deve combaciare con la somma delle righe (tolleranza arrotondamenti):
  -- impedisce di forgiare un totale piccolo con righe reali (frode sul pagamento online).
  IF abs(COALESCE(NEW.totale, 0) - v_sum) > 0.02 THEN
    RAISE EXCEPTION 'totale_incoerente_con_righe: atteso ~%, ricevuto %', v_sum, NEW.totale
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION core.web_ordine_totale_integrita() IS
  'Constraint trigger: per ordini creati da cliente web, verifica che il totale combaci con la somma delle righe (anti-frode pagamento, audit sicurezza 2026-08). Staff di cassa esclusi.';

DROP TRIGGER IF EXISTS trg_web_ordine_totale_integrita ON core.ordini;
CREATE CONSTRAINT TRIGGER trg_web_ordine_totale_integrita
  AFTER INSERT ON core.ordini
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION core.web_ordine_totale_integrita();
