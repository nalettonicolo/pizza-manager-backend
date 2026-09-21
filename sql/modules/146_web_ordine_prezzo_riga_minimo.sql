-- ============================================================================
-- 146 — Prezzo minimo per riga negli ordini CLIENTE WEB (chiude la falla residua
-- del modulo 115)
-- ----------------------------------------------------------------------------
-- Il modulo 115 impedisce solo un totale INCOERENTE con le righe dichiarate — ma
-- un cliente web che manomette il frontend può ancora dichiarare `prezzo: 0.01`
-- su ogni riga e un `totale` altrettanto basso: il controllo di coerenza passa
-- comunque, perché il totale combacia con se stesso. create_order_with_items non
-- ricalcola mai il prezzo dal catalogo (OWASP A08/A04, segnalato nell'audit
-- 2026-08-30 e rimasto aperto).
--
-- Ricalcolo esatto lato server non è praticabile con il payload attuale: il
-- prezzo di una pizza personalizzata combina prezzo base + impasto + modifiche
-- ingredienti (alcune scontano) + extra + formato, con due formati speciali
-- (Famiglia multi-gusto, Mezzo Metro/Metro) — logica solo in
-- ModificaPizzaModal.jsx, e il payload verso l'RPC porta solo il prezzo già
-- calcolato, non gli ID strutturati delle scelte. Riscriverlo servirebbe un
-- redesign multi-file (frontend + RPC) rimandato a quando servirà una
-- protezione esatta al centesimo.
--
-- Protezione scelta ora (deliberatamente approssimata, non esatta): ogni riga
-- non può costare meno della metà del prezzo di listino del prodotto in
-- core.prodotti — chiude il caso concreto di abuso (pizze reali pagate pochi
-- centesimi) senza mai rifiutare uno sconto legittimo su un ingrediente tolto
-- (che riduce il prezzo di poco, mai sotto la metà del listino). Stesso
-- perimetro del modulo 115: solo ordini di un CLIENTE WEB, mai staff/cassa
-- (prezzi custom/sconti restano liberi). Prodotti senza prezzo di listino
-- positivo (es. 0€, omaggi) non sono vincolati, non c'è nulla da proteggere.
--
-- Estende lo stesso trigger del modulo 115 invece di aggiungerne uno nuovo:
-- stesso momento di esecuzione (deferred, a fine transazione, righe già
-- presenti), stesso perimetro cliente-web, un solo punto da mantenere.
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
  v_riga_bassa record;
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

  -- Modulo 146: nessuna riga sotto la metà del prezzo di listino del prodotto
  -- (quando il prodotto esiste ancora ed ha un prezzo di listino positivo).
  SELECT ro.id, ro.prezzo, p.prezzo AS prezzo_listino
    INTO v_riga_bassa
  FROM core.riga_ordine ro
  JOIN core.prodotti p ON p.id = ro.prodotto_id
  WHERE ro.ordine_id = NEW.id
    AND COALESCE(p.prezzo, 0) > 0
    AND ro.prezzo < (p.prezzo * 0.5)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'prezzo_riga_troppo_basso: riga % a %, listino %',
      v_riga_bassa.id, v_riga_bassa.prezzo, v_riga_bassa.prezzo_listino
      USING ERRCODE = '23514';
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
  'Constraint trigger: per ordini creati da cliente web, verifica che il totale combaci con la somma delle righe e che nessuna riga costi meno della metà del prezzo di listino del prodotto (anti-frode pagamento, audit sicurezza 2026-08/09). Staff di cassa esclusi.';
