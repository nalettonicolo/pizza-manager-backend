# Go-live Francy Pizza — runbook (P2 / P3)

Checklist operativa quando sono disponibili **chiavi Stripe live**, **dominio vetrina** e account **Supabase Pro+** / vendor fiscale.

Tenant demo/produzione di riferimento: **Francy Pizza** (`95c0b10f-b677-4131-abd9-e60e8cf9e3bf` o valore `VITE_PUBLIC_DEMO_TENANT_ID`).

---

## P2 — Stripe live + smoke pagamento web

### Prerequisiti

- [ ] Account Stripe in modalità **live** (non test).
- [ ] Edge Functions deployate (nomi reali sotto), webhook configurato in Dashboard Stripe → endpoint Supabase.
- [ ] Admin tenant → **Pagamenti online**: chiavi live salvate (solo via RPC/service role, mod. 34).
- [ ] Parametro `ordini_online_attivi` = true nel tenant Francy.

### Passi

1. **Deploy edge** (se non già fatto):
   ```bash
   npx supabase functions deploy payment-stripe-create-intent
   npx supabase functions deploy payment-stripe-confirm
   npx supabase functions deploy payment-stripe-refund
   npx supabase functions deploy payment-stripe-webhook
   ```
2. **Verifica raggiungibilità** (senza pagamento):
   ```bash
   npm run verify:stripe-edge
   ```
3. **Webhook Stripe live** → URL `https://<project-ref>.supabase.co/functions/v1/payment-stripe-webhook` con secret in Supabase secrets / Admin tenant.
4. **Smoke manuale** (vetrina Francy):
   - [ ] Menu pubblico carica (`/menu` o dominio custom).
   - [ ] Checkout con carta **live** di test Stripe (importo minimo) → ordine `IN_ATTESA` → webhook → `IN_PREPARAZIONE`.
   - [ ] Comanda visibile in **Cucina** / **Cassa** (stampa automatica se abilitata).
5. **Smoke automatico whitelist PO** (mod. 40):
   ```bash
   npm run verify:public-po
   ```

### Rollback

- Disattivare `ordini_online_attivi` in Admin → Parametri operativi.
- Revocare webhook live in Stripe Dashboard se necessario.

---

## P2 — Dominio menu Francy (DNS + Firebase + Auth)

### Prerequisiti

- [ ] Dominio registrato (es. `menu.francypizza.it`).
- [ ] Accesso DNS registrar + Firebase Hosting + Supabase Auth.

### Passi

1. **Super Admin → Pubblicazione dominio**: associare dominio al tenant Francy; stato «attivo».
2. **Firebase Hosting**: custom domain, certificato SSL attivo.
3. **DNS**: record A/AAAA o CNAME come da Firebase Console.
4. **Supabase Auth → Redirect URLs**:
   - [ ] `https://<dominio>/reimposta-password`
   - [ ] eventuale wildcard se più sottodomini vetrina.
5. **Site URL** coerente (`https://pizzamanager.it` o dominio SaaS).
6. **Smoke**:
   ```bash
   CHECK_URL=https://<dominio>/ npm run check:live
   ```
   - [ ] Menu, login cliente, reset password non bloccati da redirect.
   - [ ] `resolve_public_tenant_by_domain` restituisce tenant Francy (non generico).

Vedi anche `docs/QA_CHECKLIST_SMOKE.md` § Super Admin → Supabase Auth.

---

## P3 — Auth HIBP (Have I Been Pwned)

**Richiede Supabase Pro+** (Leaked Password Protection).

1. Dashboard Supabase → **Authentication → Providers → Email** (o Security).
2. Abilitare **Leaked password protection** / HIBP.
3. Smoke: tentativo registrazione con password nota compromessa → rifiutata con messaggio chiaro.
4. Documentare data attivazione in ticket interno.

---

## P3 — Adapter notifiche / RT-SDI

Implementazione adapter (codice in repo; manca solo configurazione secrets + vendor):

| Canale | Path adapter | Stato codice |
|--------|----------------|--------------|
| Email SMTP / relay | `…/adapters/email-smtp.ts` | **Implementato** — relay o SMTP |
| SMS | `…/adapters/sms.ts` | **Implementato** — POST `NOTIFY_SMS_API_URL` |
| WhatsApp | `…/adapters/whatsapp.ts` | **Implementato** — POST `NOTIFY_WHATSAPP_API_URL` |
| RT-SDI fiscale | `…/fiscal/adapters/rt-sdi.ts` | **Implementato** — POST `FISCAL_RT_API_URL` |

### Secrets Edge (SMTP)

```bash
npx supabase secrets set NOTIFY_FROM_EMAIL=noreply@tuodominio.it
npx supabase secrets set NOTIFY_SMTP_HOST=smtp.tuoprovider.it
npx supabase secrets set NOTIFY_SMTP_PORT=587
npx supabase secrets set NOTIFY_SMTP_USER=...
npx supabase secrets set NOTIFY_SMTP_PASS=...
# oppure relay Nest/interno:
# npx supabase secrets set NOTIFY_EMAIL_RELAY_URL=https://.../internal/notifications/email
# npx supabase secrets set NOTIFY_EMAIL_RELAY_KEY=...
```

### Secrets Edge (SMS / WhatsApp)

```bash
npx supabase secrets set NOTIFY_SMS_API_URL=https://gateway.example/sms
npx supabase secrets set NOTIFY_SMS_API_KEY=...
npx supabase secrets set NOTIFY_WHATSAPP_API_URL=https://graph.facebook.com/.../messages
npx supabase secrets set NOTIFY_WHATSAPP_TOKEN=...
npx supabase functions deploy notifiche-outbox-processor
```

### Secrets Edge (RT-SDI)

```bash
npx supabase secrets set FISCAL_RT_API_URL=https://api.vendor.example/v1/documenti
npx supabase secrets set FISCAL_RT_API_KEY=...
# opzionale header custom: FISCAL_RT_API_HEADER=X-Api-Key
npx supabase functions deploy fiscal-outbox-processor
```

### Checklist operativa

- [ ] SMTP/relay: secrets + deploy worker + smoke email.
- [ ] SMS/WhatsApp: secrets + smoke staging.
- [ ] RT-SDI: contratto vendor + secrets + smoke fiscale.

Riferimento flusso ordini web: `docs/GO_LIVE_ORDINI_WEB.md`.

---

## Verifiche post go-live

```bash
npm run verify:public-po          # mod. 40 whitelist
npm run verify:stripe-edge        # Edge Stripe raggiungibili
npm run verify:rls-inventory      # inventario RLS (token CLI)
npm run verify:rls-jwt-ab         # cross-tenant (serve JWT A/B in env)
npm run check:live                # bundle hosting
npm run e2e:smoke                 # Playwright (pubblico + auth SKIP senza env)
```

---

*Aggiornato 2026-08-04 — priorità P2/P3 da `docs/punto-situazione/11_priorita_operative.md`*
