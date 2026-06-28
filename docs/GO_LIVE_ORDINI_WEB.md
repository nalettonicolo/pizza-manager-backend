# Go-live ordini web (produzione oggi)

Guida operativa **senza** completare adapter SMTP/SMS/WhatsApp/RT esterni.

## Flusso ordine web in produzione

1. Cliente checkout → `create_order_with_items` (modulo 25: `IN_ATTESA` se Stripe, capacity forno, antifraud).
2. **Stampa comanda automatica**: attiva `stampa_comanda_ordine_web_automatica` in Parametri operativi → la cucina/cassa riceve la comanda senza email/SMS.
3. **Notifiche outbox**: resta come **log** e coda per canali futuri; **non** serve cron Resend.
4. Pagamento Stripe: Edge `payment-stripe-*` + webhook; ordine passa da `IN_ATTESA` a `IN_PREPARAZIONE` dopo conferma.

## Schermate operative da usare

| Reparto | URL |
|---------|-----|
| Cucina | `/operative/cucina` |
| Cassa | `/operative/cassa` |
| Delivery desk | `/operative/delivery` |
| Rider PWA | `/operative/rider` |
| Mappa live | `/operative/delivery/mappa` |

## Capacity forno (checkout)

- Parametro `pizze_ogni_15_min` (Admin → Parametri operativi).
- Checkout vetrina: fasce piene nascoste/disabilitate; server rifiuta con `slot_forno_pieno`.
- RPC `vetrina_slot_carico_oggi` aggiornata ogni minuto in checkout.

## Anti-frode base

- Max 8 ordini web / ora / cliente (`assert_web_cliente_antifraud`).
- Blocklist staff: tabella `web_cliente_blocklist`.

## Proof of delivery

- Rider: «Consegnato» → firma/foto → `delivery_mark_consegnato_with_proof`.
- Dati in `core.consegna_prova`.

## Quando completare un canale notifiche/fiscale

Implementare **un solo file** in:

- `supabase/functions/_shared/notifications/adapters/` (email-smtp, sms, whatsapp)
- `supabase/functions/_shared/fiscal/adapters/rt-sdi.ts`

Il resto del flusso (outbox, worker, admin monitor) è già cablato.

## SQL da applicare

```bash
npm run sql:apply -- sql/modules/25_ordini_web_capacity_antifraud_delivery_proof.sql
```

## Deploy

```bash
npm run deploy:full:ci
```

Edge (opzionale, quando servono worker):

```bash
npx supabase functions deploy fiscal-outbox-processor
npx supabase functions deploy billing-stripe-portal
```
