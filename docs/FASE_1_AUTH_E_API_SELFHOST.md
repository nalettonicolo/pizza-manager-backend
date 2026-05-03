# Fase 1 — Auth Nest, API self-host e convivenza con Supabase

**Prerequisito:** [Fase 0 — Rete pubblica sicura](./FASE_0_RETE_SELFHOST.md) (HTTPS sull’API, Postgres non esposto su Internet, `DATABASE_URL` verso `127.0.0.1` o LAN).

Obiettivo di questa fase: usare in produzione il **backend Nest** raggiungibile dal browser (`VITE_API_URL`), con **login JWT** opzionale (`VITE_USE_NEST_AUTH`), mantenendo **Supabase** per dati, RLS, Realtime e RPC dove l’app li usa ancora.

---

## 1.1 — Ruoli nel codice (oggi)

| Componente | Ruolo |
|------------|--------|
| **Supabase** (`VITE_SUPABASE_*`) | Postgres con RLS, sessione `auth.users` quando `VITE_USE_NEST_AUTH` è **false**, Realtime, Edge, RPC lato client. |
| **Nest** (`VITE_API_URL`, prefisso `/api`) | Auth email/password su tabella **`core.users`** (Prisma), JWT in header `Authorization: Bearer`; endpoint operativi protetti da `JwtAuthGuard` dove implementati. |
| **Frontend** | `src/lib/nestAuthMode.js`: se `VITE_USE_NEST_AUTH=true` **e** `VITE_API_URL` valorizzato, `AuthContext` usa `nestAuthLogin` / `nestAuthMe` / refresh / logout (`src/app/api/authApi.js`) invece di `supabase.auth.signInWithPassword`. |

**RLS:** non si “sposta” su Nest con un flag: le policy restano su Supabase per le query che passano ancora dal client con JWT Supabase. Le route Nest che usano Prisma devono rispettare **multi-tenant** lato server (es. `tenantId` nel JWT + guard), come da pattern esistenti nel backend.

---

## 1.2 — Allineamento identità (critico prima del cutover)

- Il login Nest usa **`core.users.id`** come `sub` nel JWT.
- Il flusso Supabase classico usa **`auth.users.id`** in `utenti_ruoli.user_id` e altre tabelle.
- Se i due ID **non coincidono**, query Supabase filtrate per `user_id` della sessione Supabase non combaceranno con l’utente Nest.

**Percorsi possibili:**

1. **Solo API self-host, auth ancora Supabase** (`VITE_USE_NEST_AUTH=false`): nessun problema di doppio ID; Nest serve integrazioni con `DATABASE_URL` sullo stesso DB (o pooler Supabase) senza cambiare login browser.
2. **Nest auth attivo** (`VITE_USE_NEST_AUTH=true`): assicurarsi che gli utenti staff abbiano **password argon2** in `core.users` e che, per le parti di UI che ancora leggono Supabase con sessione anon/authenticated, i vincoli di business siano coerenti (stesso `tenant_id`, eventuale stesso UUID se avete unificato `users` ↔ `auth.users` — da pianificare con script/migration dedicate, fuori scope di questo solo documento).
3. **Reset password in app:** con Nest auth, `updatePassword` in `AuthContext` restituisce errore guidato finché non esiste un endpoint backend dedicato.

---

## 1.3 — Variabili ambiente

### Backend (`server/pizzeria-backend/.env`, non in git)

Oltre a Fase 0 (`PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`):

- `CORS_ORIGIN` deve includere **tutte** le origini da cui la SPA è servita (es. `https://pizzamanager.it`, `https://www.pizzamanager.it`, eventuale dominio Firebase `*.web.app` in fase di test).

### Frontend build produzione (`.env.production`, gitignored)

| Variabile | Valore tipico Fase 1 |
|-----------|----------------------|
| `VITE_API_URL` | `https://api.tuodominio.it` (senza slash finale) |
| `VITE_USE_NEST_AUTH` | `true` solo dopo verifica utenti/password su `core.users`; altrimenti `false` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Invariati finché i dati restano su Supabase |

Dopo ogni modifica: `npm run build` e deploy hosting (es. `npm run deploy:hosting`).

---

## 1.4 — Smoke check API da Internet

```bash
curl -sI "https://api.tuodominio.it/api"
curl -sX POST "https://api.tuodominio.it/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

Attesi: TLS ok; login risposta 401 JSON coerente (non HTML da proxy errato).

---

## 1.5 — Servizio systemd (avvio al boot)

Template in repo: **`infra/selfhost/pizzamanager-api.service.example`**.

Sintesi operativa:

1. `npm ci && npm run build` sul server nella cartella `server/pizzeria-backend`.
2. Copiare/adattare l’unit file in `/etc/systemd/system/`, creare `/etc/pizzamanager/api.env` con le stesse chiavi del `.env`.
3. `sudo systemctl daemon-reload && sudo systemctl enable --now pizzamanager-api` (nome servizio adattato al file installato).

Nest in ascolto su `127.0.0.1:3001` + Caddy sulla 443 resta il modello consigliato in Fase 0.

---

## 1.6 — Checklist Fase 1

- [ ] `VITE_API_URL` punta all’API HTTPS pubblica (stesso schema che usano i browser degli operatori).
- [ ] `CORS_ORIGIN` sul backend elenca l’origine reale della SPA.
- [ ] Scelta consapevole `VITE_USE_NEST_AUTH` true/false in base a allineamento `core.users` e password.
- [ ] Smoke manuale: login, area operativa (ordini/letture via Nest se attive), una lettura Supabase ancora usata (es. menu) senza errori RLS.
- [ ] Servizio systemd (o altro supervisor) per `node dist/src/main.js` dopo reboot (verifica con `find dist -name main.js` se aggiorni Nest/tsconfig).

---

## Prossimi passi (fuori da questa fase)

- Taglio progressivo dipendenze Supabase: `docs/MIGRAZIONE_SUPABASE_A_POSTGRES.md` (Postgres dedicato), `docs/MIGRAZIONE_MYSQL_E_BACKUP.md` (percorso MySQL), `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` (macro epic).
- Endpoint reset password / invito utente lato Nest se il login resta solo Nest.

*Documento operativo allineato al codice in `src/app/contexts/AuthContext.jsx`, `src/app/api/authApi.js`, `server/pizzeria-backend/src/auth/*`.*
