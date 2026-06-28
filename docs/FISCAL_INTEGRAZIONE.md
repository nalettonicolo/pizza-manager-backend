# Integrazione fiscale RT/SDI

Pattern identico alle notifiche: outbox + worker + adapter.

## Layer

| Layer | Path |
|-------|------|
| Outbox DB | `fiscal_outbox`, RPC `claim_fiscal_outbox_batch` |
| Worker Edge | `supabase/functions/fiscal-outbox-processor` |
| Registry | `supabase/functions/_shared/fiscal/registry.ts` |
| Adapter RT | `supabase/functions/_shared/fiscal/adapters/rt-sdi.ts` |

## Completare RT/SDI

1. Configurare env Edge: `FISCAL_RT_API_URL`, `FISCAL_RT_API_KEY` (o credenziali per tenant in DB).
2. Implementare `sendRtSdi()` con POST verso provider del tenant.
3. Tipi outbox supportati: `rt_document`, `sdi_invoice`.
4. `export_file` / `noop_test`: già gestiti come ack/sent.

## Billing tenant Stripe

Edge stub: `supabase/functions/billing-stripe-portal`

Env: `STRIPE_BILLING_SECRET_KEY` + webhook abbonamenti (da completare).
