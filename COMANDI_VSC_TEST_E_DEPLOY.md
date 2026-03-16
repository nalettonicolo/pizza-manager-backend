# Comandi VS Code – PizzaManager

Esegui nel **terminale** (`` Ctrl+` ``). Due tab: uno per backend, uno per frontend.

---

## 1. Variabili ambiente

**Root del progetto** (`.env`):

- `VITE_SUPABASE_URL` – URL progetto Supabase (es. `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` – Chiave anon del progetto Supabase

**Backend** (`server/pizzeria-backend/.env`):

- `DATABASE_URL` – connection string Postgres Supabase (Settings → Database)
- `JWT_SECRET` – stringa segreta per i token

---

## 2. Supabase – SQL (una volta per progetto/ambiente)

In **Supabase → SQL Editor** esegui **in quest’ordine**:

1. **Solo se vuoi reset completo del DB**  
   Copia/incolla ed esegui:  
   `server/pizzeria-backend/prisma/reset_and_recreate_database.sql`

2. **Obbligatorio per login e area admin/superadmin**  
   Copia/incolla ed esegui:  
   `server/pizzeria-backend/prisma/grant_public_auth.sql`  
   - Dà al ruolo `authenticated` i permessi su `utenti_ruoli` e `clienti`  
   - Crea la vista **public.tenants** (il frontend cerca `tenants` in public; la tabella è in `core.tenants`)  
   Senza questo script: "permission denied" al login e "Could not find the table public.tenants" dopo il redirect.

3. **Tabella punti vendita (se usi area operativa / PvContext)**  
   Esegui: `server/pizzeria-backend/prisma/create_punti_vendita.sql`  
   Poi, per il **primo** punto vendita: `server/pizzeria-backend/prisma/seed_primo_punto_vendita.sql`  
   (inserisce "Sede principale" per il primo tenant; gli altri li crei da superadmin).  
   Se l’API restituisce 404 su `punti_vendita`: in Dashboard → Project Settings → API → **Exposed schemas** aggiungi **core**.

4. **Dopo il seed Prisma** (per collegare Auth ai ruoli)  
   Esegui:  
   `server/pizzeria-backend/prisma/seed_utenti_ruoli_supabase_auth.sql`  
   Oppure il seed Prisma fa già la sync da Auth; in quel caso questo step serve solo se aggiungi utenti a mano in Supabase Auth.

---

## 3. Backend – comandi in ordine

```powershell
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
npm install
npx prisma generate
npx prisma db seed
npm run start:dev
```

- API: **http://localhost:3000**
- Se l’IDE segnala errori in `seed.ts` (SUPERADMIN, costoUnitario, ecc.): esegui `npx prisma generate` e, se serve, Command Palette → “TypeScript: Restart TS Server”.

---

## 4. Frontend – secondo tab

```powershell
cd d:\APP_PIZZERIA\PizzaManagerApp
npm install
npm run dev
```

- App: **http://localhost:5173**
- Login: **admin@pizzamanager.it** (e password impostata in Supabase Auth)

**Nota:** Alla prima richiesta dopo il login possono comparire in console “utenti_ruoli timeout” / “clienti timeout”: la sessione a volte non è pronta in tempo. Il flusso riprova; se grant e seed sono ok, al secondo giro vedi “utente STAFF” e redirect a `/superadmin`. Se dopo il redirect compare “Could not find the table public.tenants”, esegui di nuovo **grant_public_auth.sql** in Supabase.

---

## 5. Deploy

**Build**

- Backend: `cd server\pizzeria-backend` → `npx prisma generate` → `npm run build` (output in `dist/`)
- Frontend: dalla root → `npm run build` (output in `dist/`)

**Backend (Railway / Render / Fly.io)**

- Build: `npm install && npx prisma generate && npm run build`
- Start: `npm run start:prod`
- Env: `DATABASE_URL`, `JWT_SECRET`

**Frontend (Vercel / Netlify)**

- Publish: cartella `dist`
- Env: `VITE_API_URL` (URL backend), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Riepilogo

| Cosa | Dove / Comando |
|------|-----------------|
| Env frontend | `.env`: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY |
| Permessi + vista tenants | Supabase SQL Editor: **grant_public_auth.sql** (obbligatorio) |
| Tabella punti vendita | Supabase: **create_punti_vendita.sql**; se 404 API → Exposed schemas aggiungi "core" |
| Reset DB | Supabase: reset_and_recreate_database.sql (opzionale) |
| Backend | `server/pizzeria-backend`: npm install → prisma generate → prisma db seed → npm run start:dev |
| Frontend | Root: npm install → npm run dev |
| Login | admin@pizzamanager.it (Supabase Auth) |
