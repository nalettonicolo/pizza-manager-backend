# E2E Playwright — smoke pubblico (P4)

Base minima per regressioni hosting **senza login** (home, contatti, login, privacy, negozio) + scaffold autenticato.

## Setup locale

```bash
npm install
npm run e2e:install    # scarica Chromium
npm run e2e:smoke        # default https://pizzamanager.it
E2E_BASE_URL=http://127.0.0.1:4173 npm run e2e:smoke   # dopo vite preview
```

### Auth opzionale

```bash
E2E_STAFF_EMAIL=... E2E_STAFF_PASSWORD=... npm run e2e:smoke
```

Senza queste env, `e2e/smoke-auth.spec.js` viene **SKIP** (non fallisce CI).

## CI

Workflow opzionale `.github/workflows/e2e-smoke.yml` (manuale / post-deploy).

## Estensioni future

- Checkout Stripe test mode su tenant staging.
- Demo live SA: account superadmin in secrets.

Vedi gap in `docs/punto-situazione/08_test.md`.
