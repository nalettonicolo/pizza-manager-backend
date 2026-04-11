-- =============================================================================
-- 12) Fiscal outbox + payment link intents (Italia: RT / SDI / PSP — scheletro)
-- =============================================================================
-- Coda invii verso registratore telematico, intermediari SDI o export file.
-- Tabella separata per richieste "paga con link" (SMS / hosted page) con webhook.
-- tenant_id / ordine_id allineati a core (vista public."Ordine" → core.ordini).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fiscal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID REFERENCES core.ordini(id) ON DELETE SET NULL,
  punto_vendita_id UUID,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'corrispettivo_rt',
      'chiusura_giornaliera_rt',
      'annullo_rt',
      'sdi_fattura',
      'sdi_nota_credito',
      'export_file',
      'noop_test'
    )
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'ack', 'failed', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  payload_canonical JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_key TEXT,
  provider_request JSONB,
  provider_response JSONB,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fiscal_outbox_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_tenant_status
  ON public.fiscal_outbox(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_ordine
  ON public.fiscal_outbox(ordine_id)
  WHERE ordine_id IS NOT NULL;

COMMENT ON TABLE public.fiscal_outbox IS
  'Coda fiscal: corrispettivi RT, chiusure, SDI, export. Adapter esterni mappano payload_canonical → fornitore.';

COMMENT ON COLUMN public.fiscal_outbox.payload_canonical IS
  'Payload interno stabile (importi, righe, aliquote, riferimenti ordine) prima del mapping verso il provider.';

COMMENT ON COLUMN public.fiscal_outbox.provider_key IS
  'Identificativo implementazione: es. rtmiddleware_acme, export_xml_v1, noop.';

-- -----------------------------------------------------------------------------
-- Richieste pagamento remoto (link su smartphone / ordine telefonico)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_link_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  importo_cent BIGINT NOT NULL CHECK (importo_cent > 0),
  valuta TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'opened', 'paid', 'failed', 'expired', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  destinatario_telefono TEXT,
  payment_url TEXT,
  provider_key TEXT,
  provider_intent_id TEXT,
  provider_payload JSONB,
  last_error TEXT,
  sms_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_link_intents_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_tenant_status
  ON public.payment_link_intents(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_ordine
  ON public.payment_link_intents(ordine_id);

COMMENT ON TABLE public.payment_link_intents IS
  'Intent pay-by-link: generazione URL, invio SMS, stato da webhook PSP.';

-- -----------------------------------------------------------------------------
-- RLS (staff tenant via utenti_ruoli, come contabilita_movimenti)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fiscal_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_link_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_outbox_staff_all" ON public.fiscal_outbox;
CREATE POLICY "fiscal_outbox_staff_all" ON public.fiscal_outbox
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "payment_link_intents_staff_all" ON public.payment_link_intents;
CREATE POLICY "payment_link_intents_staff_all" ON public.payment_link_intents
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_intents TO authenticated;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.pm_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_fiscal_outbox_updated ON public.fiscal_outbox;
CREATE TRIGGER tr_fiscal_outbox_updated
  BEFORE UPDATE ON public.fiscal_outbox
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

DROP TRIGGER IF EXISTS tr_payment_link_intents_updated ON public.payment_link_intents;
CREATE TRIGGER tr_payment_link_intents_updated
  BEFORE UPDATE ON public.payment_link_intents
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
