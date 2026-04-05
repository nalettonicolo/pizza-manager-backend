-- Ciclo fatturazione (30 = mensile, 365 = annuale) e sconto % sul totale annuale (anticipo unica rata).

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN public.subscriptions.ciclo_fatturazione_giorni IS 'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN public.subscriptions.sconto_annuale_percent IS 'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;

  IF to_regclass('core.subscriptions') IS NOT NULL THEN
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN core.subscriptions.ciclo_fatturazione_giorni IS 'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN core.subscriptions.sconto_annuale_percent IS 'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;
END $$;
