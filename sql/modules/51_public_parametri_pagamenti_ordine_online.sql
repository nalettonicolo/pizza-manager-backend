-- Espone flag pagamenti Contanti/Carta/Paga online alla vetrina (checkout ordine online).

CREATE OR REPLACE FUNCTION public.pm_public_parametri_operativi(p_po JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_src JSONB := COALESCE(p_po, '{}'::JSONB);
  v_out JSONB := '{}'::JSONB;
  v_keys TEXT[] := ARRAY[
    'ordini_online_attivi',
    'menuTheme',
    'promozioni_calendario',
    'consegna_area_poligono',
    'consegna_domicilio_attiva',
    'pizze_ogni_15_min',
    'fidelity_attivo',
    'fidelity_abilita_clienti_domicilio',
    'fidelity_modalita_accredito',
    'fidelity_timbri_per_pizza',
    'fidelity_timbri_scheda_totale',
    'fidelity_premi',
    'fidelity_punti_per_euro',
    'ordini_web_accettazione_mode',
    'cassa_pagamento_contanti',
    'cassa_pagamento_carta',
    'cassa_pagamento_paga_online'
  ];
  k TEXT;
BEGIN
  IF jsonb_typeof(v_src) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::JSONB;
  END IF;
  FOREACH k IN ARRAY v_keys LOOP
    IF v_src ? k THEN
      v_out := v_out || jsonb_build_object(k, v_src -> k);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.pm_public_parametri_operativi(JSONB) IS
  'Sottoinsieme parametri_operativi sicuro per anon/vetrina (mod. 40 + 46 + 51).';
