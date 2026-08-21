# Guida test pagamenti online (multi-gestore)

Tenant demo di riferimento: **PizzaManager.it** (ex Francy Pizza, id `95c0b10f-b677-4131-abd9-e60e8cf9e3bf`).

Cliente / operativo demo: **Cliente Test** — `info@pizzamanager.it` / `DemoCliente!2026`  
(visibile anche in Admin → Staff/Ruoli e archivio password come utente **cassa**)  
Indirizzo: Via Pontedera 4, Padova 35124 · Tel. 123456789

---

## 0. Preparazione comune (una sola volta)

1. Crea/aggiorna il cliente demo:

```bash
node scripts/ensure-demo-cliente.mjs --sumup
```

2. Nel `.env` locale (poi riavvia `npm run dev`):

```env
VITE_PUBLIC_DEMO_TENANT_ID=95c0b10f-b677-4131-abd9-e60e8cf9e3bf
VITE_DEMO_CLIENTE_EMAIL=info@pizzamanager.it
VITE_DEMO_CLIENTE_PASSWORD=DemoCliente!2026
```

3. Login Super Admin → **Area cliente**  
   Entri già autenticato come Cliente Test (sessione SA salvata; pulsante «Torna a Super Admin»).

4. Admin locale → **Impostazioni → Vetrina → Pagamenti online**  
   - Spunta «Attiva ordini e pagamento online in vetrina»  
   - Abilita «In vetrina» sul gestore da testare  
   - Checklist deve mostrare almeno un gestore **Pronto in vetrina** (Stripe o SumUp)

5. Percorso ordine: Area cliente → **Carrello / Ordine consegna** → pagamento online.

---

## 1. SumUp (checkout live — prioritario)

### Credenziali sandbox

SumUp **non** pubblica una merchant condivisa: ogni account sviluppatore crea un sandbox.

1. Accedi a [me.sumup.com](https://me.sumup.com) (o registrati come developer).
2. **Developer Settings → Sandboxes** → crea sandbox merchant.
3. Copia il **merchant code** (es. `MH4H92C7`).
4. **API Keys** → crea chiave di test (`sup_sk_…` o `sk_test_…`).

### Configurazione PizzaManager

**Opzione A — Admin UI**

1. Impostazioni → Pagamenti online → card **SumUp**
2. Merchant code + API key → Salva
3. Toggle **In vetrina** ON

**Opzione B — Script**

```powershell
$env:SUMUP_MERCHANT_CODE="TUO_CODICE"
$env:SUMUP_API_KEY="sup_sk_..."
node scripts/ensure-demo-cliente.mjs --sumup
```

### Smoke test

1. Area cliente → ordine consegna → **Pagamento online** → SumUp  
2. Redirect pagina hosted SumUp  
3. Carte test SumUp (vedi anche Admin → Pagamenti online → Area test):  
   - OK Visa: `4200 0000 0000 0091`  
   - OK Mastercard: `5200 0000 0000 0007`  
   - 3DS Visa: `4200 0000 0000 0042`  
   - Scadenza futura, CVV qualsiasi (es. `123`)  
4. Nota: importo **11** (qualsiasi valuta) fallisce **di proposito** in sandbox  
5. Al ritorno su `/cliente/ordini?nuovo=…&sumup=1` l’ordine passa in **IN_PREPARAZIONE**

---

## 2. Stripe (checkout live)

### Credenziali test

1. [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
2. **Publishable** `pk_test_…` + **Secret** `sk_test_…`
3. (Opzionale) Webhook → URL mostrato in Pagamenti online → eventi `payment_intent.succeeded` / `payment_intent.payment_failed` → Signing secret `whsec_…`

### Configurazione

Card **Stripe** in Pagamenti online → salva pk + sk → **In vetrina** ON.

### Smoke test

1. Checkout → Pagamento online → Stripe  
2. Carta test: `4242 4242 4242 4242`, scadenza futura, CVC qualsiasi  
3. Ordine: **IN_ATTESA** → dopo conferma **IN_PREPARAZIONE**

Carta rifiuto: `4000 0000 0000 0002`.

---

## 3. Satispay (configurabile ora — checkout in arrivo)

Stato: **config_only** (salva credenziali; non ancora nel selettore vetrina).

### Credenziali sandbox

1. [developers.satispay.com](https://developers.satispay.com)  
2. Crea chiave sandbox → **Key ID** + **token**

### Configurazione

Pagamenti online → card **Satispay** → Key ID + token → Salva → **In vetrina** (opzionale, per pronta attivazione).

### Quando sarà live

Checkout vetrina mostrerà Satispay tra i gestori; serve Edge Function `payment-satispay-*` (da implementare).

---

## 4. Nexi XPay (configurabile ora — checkout in arrivo)

Stato: **config_only**.

### Credenziali test

1. [developer.nexi.it](https://developer.nexi.it) / area sandbox XPay  
2. **Alias** commerciante + chiave API / MAC di test

### Configurazione

Card **Nexi** → Alias + chiave segreta → Salva.

### Quando sarà live

Hosted redirect Nexi + confirm Edge (simile a SumUp).

---

## 5. PayPal (configurabile ora — checkout in arrivo)

Stato: **config_only**.

### Credenziali sandbox

1. [developer.paypal.com](https://developer.paypal.com) → Sandbox Apps  
2. **Client ID** + **Secret**

### Configurazione

Card **PayPal** → Client ID + Secret → Salva.

---

## Multi-gestore in vetrina

Se **Stripe e SumUp** sono entrambi «In vetrina» e pronti, al checkout il cliente vede **Scegli come pagare**.  
Satispay / Nexi / PayPal compaiono in vetrina solo dopo che l’implementazione Edge passa a `live` in `src/constants/onlinePaymentProviders.js`.

---

## Checklist rapida

| Gestore  | Credenziali dove | Checkout vetrina | Script / note                          |
|----------|------------------|------------------|----------------------------------------|
| SumUp    | Sandbox SumUp    | Sì               | `SUMUP_*` + `--sumup`                  |
| Stripe   | Dashboard test   | Sì               | pk_test_ / sk_test_                    |
| Satispay | Developer portal | No (ancora)      | Key ID + token in Admin                |
| Nexi     | XPay sandbox     | No (ancora)      | Alias + API key in Admin               |
| PayPal   | Sandbox apps     | No (ancora)      | Client ID + Secret in Admin            |

---

## Troubleshooting

| Sintomo | Cosa controllare |
|---------|------------------|
| Area cliente non logga Cliente Test | `node scripts/ensure-demo-cliente.mjs` + `VITE_DEMO_CLIENTE_*` |
| «Pagamento online non configurato» | Toggle vetrina + almeno un gestore live ready |
| SumUp 502 create checkout | Merchant code + API key sandbox; Edge `payment-sumup-create-checkout` |
| Stripe Elements non apre | `pk_test_` sul tenant + Edge create-intent |
| Torna a SA fallisce | Rifare login SA da `/login` (stash sessione scaduto) |
