# Go-live Francy Pizza — runbook (P2 / P3)

Checklist operativa per **Stripe** (prima TEST, poi live), **dominio vetrina** e account **Supabase Pro+** / vendor fiscale.

Tenant demo/produzione di riferimento: **Francy Pizza** (`95c0b10f-b677-4131-abd9-e60e8cf9e3bf` o valore `VITE_PUBLIC_DEMO_TENANT_ID`).

---

## P2 — Stripe TEST (fare prima del live)

### Prerequisiti (controlla prima di iniziare)

- [ ] Sei loggato in [dashboard.stripe.com](https://dashboard.stripe.com) con **Test mode** attivo (interruttore in alto a destra: deve dire **Test mode**, non Live).
- [ ] Sei loggato in PizzaManager come **admin del locale** (o Super Admin in Demo live sul tenant Francy).
- [ ] Edge Functions già deployate sul progetto `flfhrwzlrftuhkrfwzse` (create-intent / confirm / refund / webhook).
- [ ] Sul tenant: servizio piano **Ordini online** attivo (Super Admin → Clienti / Piani).
- [ ] In Admin → Parametri: `ordini_online_attivi` = true (altrimenti il checkout online non parte).

### A) Copiare le chiavi API da Stripe (Test)

1. Nella Dashboard Stripe, in alto a destra verifica **Test mode** = ON.
2. Menu sinistro: **Developers** → **API keys**.
3. Nella sezione **Standard keys** trovi:
   - **Publishable key** → inizia con `pk_test_…` → **Reveal** / **Copy**.
   - **Secret key** → inizia con `sk_test_…` → **Reveal test key** → **Copy**.
4. Incollale temporaneamente in un blocco note (non in chat pubblica). Non usare chiavi `pk_live_` / `sk_live_` in questa fase.

### B) Salvare le chiavi in PizzaManager

1. Apri l’admin del locale:  
   `https://pizzamanager.it/admin/settings/pagamenti-online`  
   (oppure barra admin → **Impostazioni** → sidebar **Pagamenti online**).
2. **Provider pagamento online** → scegli **Stripe** (si salva subito).
3. Campo **Chiave pubblica**:
   - Incolla `pk_test_…`
   - Clicca **Salva chiave pubblica**
   - Atteso: conferma; badge «Modalità rilevata: TEST».
4. Campo **Chiave segreta**:
   - Incolla `sk_test_…`
   - Clicca **Salva chiave segreta**
   - Atteso: «Segreto presente» in verde; il campo si svuota (il valore non viene più mostrato).
5. Clicca **Aggiorna stato** nella checklist in alto:
   - ✓ Provider = Stripe  
   - ✓ Chiave pubblica  
   - ✓ Chiave segreta  
   - ○ Webhook (ancora da fare al passo C)  
   - Con pk+sk ok → «Pronto per accettare pagamenti Stripe».

Se la checklist resta incompleta: ricarica, verifica il tenant corretto, e che le chiavi inizino proprio con `pk_test_` / `sk_test_`.

### C) Creare il Webhook in Stripe (Test)

1. Stripe Dashboard (sempre **Test mode**): **Developers** → **Webhooks**.
2. **Add endpoint** (o «+ Add destination» a seconda della UI Stripe).
3. **Endpoint URL** — incolla esattamente (senza spazi né slash finale):

   ```
   https://flfhrwzlrftuhkrfwzse.supabase.co/functions/v1/payment-stripe-webhook
   ```

4. **Events to send** → seleziona almeno:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Conferma creazione endpoint (**Add endpoint** / **Create**).
6. Apri l’endpoint appena creato → **Signing secret** → **Reveal** → copia il valore `whsec_…`.

### D) Salvare il Signing secret in PizzaManager

1. Torna a **Admin → Impostazioni → Pagamenti online**.
2. Sezione **2. Webhook**:
   - Controlla che l’URL in app coincida con quello usato in Stripe (**Copia URL** se serve).
   - Incolla `whsec_…` nel campo **Signing secret**.
   - Clicca **Salva webhook secret**.
3. **Aggiorna stato** → la riga Webhook deve diventare ✓.

Opzionale (stesso account Stripe per tutti i tenant):  
`npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…`  
Non obbligatorio se hai già salvato il `whsec_` per il locale.

### E) Smoke test pagamento (carta test)

1. Apri la **vetrina** del tenant, es.  
   `https://pizzamanager.it/preview?tenant=95c0b10f-b677-4131-abd9-e60e8cf9e3bf`
2. **Accedi come cliente** (account cliente del locale, non staff cassa/admin).
3. Aggiungi almeno un prodotto → **checkout**.
4. Completa ritiro/consegna; metodo: **Pagamento online (carta)**.
5. Conferma ordine → ordine in **attesa pagamento** → compare il form carta Stripe.
6. Carta **TEST** (soldi non veri):
   - Numero: `4242 4242 4242 4242`
   - Scadenza: futura (es. `12/34`)
   - CVC: qualsiasi (es. `123`)
   - CAP / nome: qualsiasi se richiesti
7. Paga / conferma.
8. **Esito atteso**:
   - Vetrina: ordine/pagamento confermato.
   - Admin → Ordini (o Cassa / Cucina): da **IN_ATTESA** a **IN_PREPARAZIONE**.
9. Opzionale: Stripe → **Payments** (Test mode) → pagamento `Succeeded`.

#### Se si ferma: dove guardare

| Sintomo | Causa tipica |
|--------|----------------|
| Non compare «Pagamento online» | Provider non Stripe, o `ordini_online` / parametri off |
| Errore subito dopo conferma ordine | `sk_test_` mancante o Edge create-intent; Network → `payment-stripe-create-intent` |
| Form carta non carica | `pk_test_` sbagliata o mixed test/live |
| Pagamento ok ma ordine resta IN_ATTESA | Fallisce `payment-stripe-confirm`; webhook aiuta ma non è obbligatorio sul path principale |
| Webhook «fail» in Stripe Dashboard | URL sbagliato o `whsec_` non salvato / non allineato |

### Deploy / verify (solo se le Edge non rispondono)

```bash
npx supabase functions deploy payment-stripe-create-intent
npx supabase functions deploy payment-stripe-confirm
npx supabase functions deploy payment-stripe-refund
npx supabase functions deploy payment-stripe-webhook
npm run verify:stripe-edge
```

### Rollback TEST

- Disattivare `ordini_online_attivi` in Parametri, **oppure** Provider = «Non configurato» in Pagamenti online.
- In Stripe puoi disabilitare l’endpoint webhook di test.

---

## P2 — Dominio menu Francy (dopo smoke Stripe TEST)

Ancora bloccato da **DNS + Firebase Hosting + Auth redirect**. Non mescolare con lo smoke carta.

Quando lo smoke Stripe TEST è ok:

1. Dominio scelto (es. `menu.francypizza.it`) registrato e accessibile in DNS.
2. Super Admin → Pubblicazione dominio → associa al tenant Francy.
3. Firebase Hosting → custom domain + SSL.
4. DNS A/AAAA o CNAME come indicato da Firebase.
5. Supabase Auth → Redirect URLs: `https://<dominio>/reimposta-password` (+ eventuale wildcard).
6. Smoke: `CHECK_URL=https://<dominio>/ npm run check:live`

Dettaglio completo nella sezione «Dominio menu Francy» più sotto.

---
## P2 — Stripe live + smoke pagamento web

### Prerequisiti

- [ ] Smoke **TEST** già ok (sezione sopra).
- [ ] Account Stripe in modalità **live** (non test).
- [ ] Edge Functions deployate, webhook live configurato in Dashboard Stripe → endpoint Supabase.
- [ ] Admin → **Pagamenti online**: chiavi **live** salvate (pk_live_ / sk_live_ / whsec live).
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
