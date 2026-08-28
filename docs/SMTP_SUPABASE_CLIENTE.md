# SMTP Auth e email per tenant

Due livelli distinti. Non coincidono: Supabase Auth ha **un solo SMTP per progetto**.

## 1. Piattaforma — registrazione / reset password

Configurazione **manuale** in Supabase Dashboard (Auth → SMTP). Mittente: `no-reply@pizzamanager.it`.

1. **Supabase Dashboard** → Project → **Authentication** → **SMTP Settings**.
2. Abilita **Custom SMTP**.
3. Imposta:
   - **Sender email**: `no-reply@pizzamanager.it`
   - **Sender name**: `PizzaManager`
   - **Host / Port / User / Password**: casella Register.it della piattaforma (`authsmtp.securemail.pro`, porta `465`, user `no-reply@pizzamanager.it`)
4. Verifica invio con **Send test email**.
5. **Site URL** e **Redirect URLs** devono includere `https://pizzamanager.it` e i path cliente.

Le mail Auth (conferma account, reset password) usano **sempre** questo SMTP, per tutti i locali.

## 2. Tenant — dominio del locale sul profilo + script

In Superadmin → Clienti → **Email e SMTP**:

- hostname pubblico (Anagrafica) = dominio comprato da te o già del locale;
- tre caselle: `no-reply@`, `info@`, `support@` su quel dominio (create a mano su Register.it o altro);
- SMTP del locale (host/utente/password) per le **comunicazioni** (coda notifiche).

Dopo il salvataggio:

```bash
npm run supabase:auth:sync-redirects
```

Lo script legge `public_domain` da `admin.tenants` e aggiorna la allow-list Auth (link di conferma e reset password sul dominio del locale). **Non** cambia l’SMTP Auth globale (altrimenti un tenant sovrascriverebbe tutti gli altri).

## Nel codice

- Auth cliente: `src/features/public/services/clienteAuthService.js`
- Profilo tenant: `parametri_operativi` (`email_noreply`, `email_info`, `email_support`, `smtp_*`) — chiavi escluse dalla vetrina pubblica
- Notifiche ordine: `supabase/functions/_shared/notifications/processBatch.ts` usa SMTP del tenant se `smtp_host` è valorizzato, altrimenti `NOTIFY_SMTP_*` di piattaforma

## Adapter notifiche

File: `supabase/functions/_shared/notifications/adapters/email-smtp.ts`

Secret di fallback piattaforma:

- `NOTIFY_SMTP_HOST`, `NOTIFY_SMTP_PORT`, `NOTIFY_SMTP_USER`, `NOTIFY_SMTP_PASS`, `NOTIFY_FROM_EMAIL`
