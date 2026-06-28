# SMTP Auth Supabase — email cliente (no-reply@pizzamanager.it)

Configurazione **manuale** in Supabase Dashboard (Auth → SMTP). Non richiede Resend né cron PizzaManager.

## Passi

1. **Supabase Dashboard** → Project → **Authentication** → **SMTP Settings**.
2. Abilita **Custom SMTP**.
3. Imposta:
   - **Sender email**: `no-reply@pizzamanager.it`
   - **Sender name**: `PizzaManager`
   - **Host / Port / User / Password**: credenziali del provider SMTP del dominio (es. hosting Koyeb mail, Aruba, Google Workspace relay, ecc.)
4. Verifica invio con **Send test email** (reset password / magic link).
5. **Site URL** e **Redirect URLs** devono includere `https://pizzamanager.it` e path cliente (`/cliente/*`).

## Nel codice PizzaManager

- Email transazionali **Auth** (registrazione, reset password): gestite da Supabase con SMTP sopra.
- Email ordine al tenant: **non** via SaaS PizzaManager; per ora:
  - stampa comanda automatica (`stampa_comanda_ordine_web_automatica`), oppure
  - adapter `email-smtp.ts` quando il tenant configura SMTP proprio in parametri.

## Adapter notifiche (futuro)

File: `supabase/functions/_shared/notifications/adapters/email-smtp.ts`

Variabili Edge (tenant o globali):

- `NOTIFY_SMTP_HOST`, `NOTIFY_SMTP_PORT`, `NOTIFY_SMTP_USER`, `NOTIFY_SMTP_PASS`, `NOTIFY_FROM_EMAIL`

Fino ad allora la coda `notifiche_outbox` registra i tentativi con stato `fallito` / `NOT_CONFIGURED` — utile come audit.
