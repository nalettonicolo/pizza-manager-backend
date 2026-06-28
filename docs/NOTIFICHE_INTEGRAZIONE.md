# Notifiche — integrazione e gap sviluppo

Architettura **adapter** (come `src/integrations/fiscal/`). Gli invii automatici email/SMS/WhatsApp sono **stub**: manca solo l’implementazione del provider scelto per tenant.

## Percorsi già operativi (nessuna API esterna PizzaManager)

| Percorso | Dove | Note |
|----------|------|------|
| Stampa comanda web | `parametri_operativi.stampa_comanda_ordine_web_automatica` | **Primario** — non accoda notifiche |
| Schermate operative | Cucina, cassa, delivery, rider PWA | Polling ordini |
| Canale `in_app` | Worker Edge `in-app.ts` | Marca outbox inviato; staff vede in sala |

## Coda `notifiche_outbox` + worker

1. Checkout web → RPC `enqueue_nuovo_ordine_web_notifica` (moduli 21 + 24)
2. Payload include `canale`: `email` \| `sms` \| `whatsapp` \| `in_app`
3. Cron/POST → `notifiche-outbox-processor` → registry adapter

### File da completare (solo integrazione)

| Canale | File stub | Cosa inserire |
|--------|-----------|---------------|
| Email | `supabase/functions/_shared/notifications/adapters/email-smtp.ts` | SMTP (env `NOTIFY_SMTP_*`) **oppure** POST Nest `/internal/notifications/email` |
| SMS | `.../adapters/sms.ts` | API gateway tenant (`NOTIFY_SMS_*` o segreti per tenant in DB) |
| WhatsApp | `.../adapters/whatsapp.ts` | WhatsApp Business API tenant (`NOTIFY_WHATSAPP_*`) |
| Deep link UI | `src/integrations/notifications/deepLinks.js` | Già pronto: `wa.me` / `sms:` senza gateway |

### Parametri tenant (`parametri_operativi`)

- `notifica_ordine_web_canale`
- `notifica_ordine_web_email`
- `notifica_ordine_web_telefono_sms`
- `notifica_ordine_web_telefono_whatsapp`

Configurabili in Admin → Impostazioni → Parametri (sezione ordini web).

## Cosa manca ancora (backlog)

### Notifiche
- [ ] Implementare `email-smtp.ts` (SMTP reale)
- [ ] Implementare `sms.ts` (provider da definire con il tenant)
- [ ] Implementare `whatsapp.ts` (API Business tenant)
- [ ] Tabella opzionale `admin.tenant_notification_secrets` (credenziali per tenant)
- [ ] Pulsanti deep link WhatsApp/SMS in Delivery / Admin ordini
- [ ] Push browser (Service Worker) per staff — opzionale

### Ordini online
- [ ] Stripe produzione E2E
- [ ] Blocco slot pieni in checkout vetrina (capacity forno)
- [ ] Anti-frode base

### Delivery / rider
- [ ] Proof of delivery (foto/firma)
- [ ] Mappa live sala comando
- [ ] Ottimizzazione percorsi

### Enterprise
- [ ] Billing abbonamenti tenant Stripe
- [ ] Adapter RT/SDI reale (`fiscal-outbox-processor`)
- [ ] API pubbliche OAuth

### Piattaforma
- [ ] Commit Git + allineamento Koyeb
- [ ] SMTP Auth `no-reply@pizzamanager.it` (Supabase Dashboard)

*Ultima revisione: 2026-06-02*
