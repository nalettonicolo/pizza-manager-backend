# Comandi da eseguire in VS Code / Cursor – Sistema operativo e test online

Esegui i comandi nel **terminale integrato** (`` Ctrl+` `` oppure **Terminal → New Terminal**).  
Scegli la cartella indicata con `cd` prima di ogni blocco.

---

## Fase 1 – Database (Supabase)

### 1.1 Esegui la migrazione SQL su Supabase

1. Apri il **Supabase Dashboard** del tuo progetto.
2. Vai su **SQL Editor**.
3. Apri il file:
   ```
   d:\APP_PIZZERIA\PizzaManagerApp\supabase\migrations\20250211000001_full_database_enterprise_core.sql
   ```
4. Copia tutto il contenuto e incollalo nell’editor SQL.
5. Clicca **Run**. Verranno creati lo schema `core`, le tabelle, gli indici e le policy RLS.

### 1.2 Connection string per Prisma

- In Supabase: **Project Settings → Database**.
- Copia l’**URI** (Connection string).  
- Formato:  
  `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`  
- Se usi **connection pooling** (porta 6543), aggiungi `?pgbouncer=true` se necessario.  
- Per Prisma con schema `core` va bene la stessa URL; lo schema si usa nel codice (già configurato).

---

## Fase 2 – Backend (NestJS + Prisma)

### 2.1 Vai nella cartella backend

```powershell
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
```

### 2.2 Installa le dipendenze

```powershell
npm install
```

### 2.3 Crea il file `.env`

Crea il file `.env` nella stessa cartella (`server\pizzeria-backend\.env`) con:

```env
DATABASE_URL="postgresql://postgres.[ref]:LA_TUA_PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres"
JWT_SECRET="una_stringa_segreta_lunga_e_casuale"
```

Sostituisci con la tua connection string e una chiave JWT sicura.

### 2.4 Genera il client Prisma (schema `core`)

```powershell
npx prisma generate
```

### 2.5 Non usare migrate (DB già creato con SQL)

Il database è già stato creato con lo script SQL. **Non** eseguire `prisma migrate dev` per non sovrascrivere lo schema `core`.  
Se in futuro vorrai usare solo Prisma per le migrazioni, potrai allineare da zero.

### 2.6 Seed (tenant demo + admin)

```powershell
npx prisma db seed
```

Dovrebbe creare nello schema **core**:
- Tenant: Pizzeria Demo (slug: `pizzeria-demo`)
- User: `admin@pizzeria.it` / `password123`
- Configurazione costi, ingredienti, prodotto Margherita

Se il seed fallisce (es. enum o tabelle con nomi diversi), controlla che lo script SQL sia stato eseguito per intero e che in Supabase le tabelle siano in `core` (core.tenants, core.users, …).

### 2.7 Avvia il backend

```powershell
npm run start:dev
```

L’API sarà disponibile su **http://localhost:3000** (o sulla porta indicata in console).  
Prova: **POST** `http://localhost:3000/auth/login` con body:

```json
{
  "email": "admin@pizzeria.it",
  "password": "password123"
}
```

---

## Fase 3 – Frontend (React + Vite)

### 3.1 Apri un nuovo terminale (seconda tab)

In VS Code/Cursor: **Terminal → New Terminal** (oppure split del terminale).

### 3.2 Vai nella root del progetto

```powershell
cd d:\APP_PIZZERIA\PizzaManagerApp
```

### 3.3 Installa le dipendenze

```powershell
npm install
```

### 3.4 Avvia il frontend in dev

```powershell
npm run dev
```

Si aprirà in genere su **http://localhost:5173**.  
Usa l’app da browser e, se hai configurato l’API sul backend, punta le chiamate a `http://localhost:3000` (o all’URL che usi in produzione).

---

## Fase 4 – Test rapido “online” (tutto in locale)

1. **Terminale 1**: backend in esecuzione (`npm run start:dev` in `server\pizzeria-backend`).
2. **Terminale 2**: frontend in esecuzione (`npm run dev` nella root).
3. Apri **http://localhost:5173** nel browser.
4. Prova il login con `admin@pizzeria.it` / `password123` (se il frontend è già collegato all’API di login).

Per “testarlo online” su un server:
- Fai il **build** del frontend (`npm run build`) e carica la cartella `dist` su un hosting statico (Vercel, Netlify, ecc.).
- Esponi il backend su un host Node (Railway, Render, Fly.io, ecc.) e imposta nel frontend la variabile d’ambiente (es. `VITE_API_URL`) con l’URL pubblico dell’API.

---

## Riepilogo comandi (copia-incolla)

**Terminale 1 – Backend**

```powershell
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
npm install
npx prisma generate
npx prisma db seed
npm run start:dev
```

**Terminale 2 – Frontend**

```powershell
cd d:\APP_PIZZERIA\PizzaManagerApp
npm install
npm run dev
```

**Prima di tutto:** esegui lo script SQL su Supabase (Fase 1.1) e crea il `.env` nel backend (Fase 2.3).
