# Comandi da eseguire per il deploy dopo ogni modifica

---

## Comandi per il deploy

Apri il terminale (in VS Code/Cursor: `` Ctrl+` ``), assicurati di essere nella **root** del progetto, poi copia e incolla uno dei blocchi sotto.

### Solo frontend (build + Firebase Hosting)

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
npm run build
npx firebase deploy --only hosting
```

Oppure in un colpo solo:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
npm run deploy
```

### Solo backend (Koyeb si aggiorna con push su GitHub)

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git add .
git commit -m "Deploy: descrizione modifica"
git push
```

Per limitare solo alla cartella backend:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git add server/pizzeria-backend/
git commit -m "Backend: descrizione modifica"
git push
```

### Frontend + backend

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git add .
git commit -m "Deploy: descrizione modifica"
git push
npm run deploy
```

---

## Spiegazione

### Backend (Koyeb)

- **Cosa fa:** `git add` → `git commit` → `git push` invia il codice (incluso `server/pizzeria-backend`) su GitHub. Koyeb è collegato al repo e avvia il build in automatico.
- **Quando:** dopo modifiche a backend Nest, Dockerfile, Prisma, env.
- **Se il deploy non parte:** in Koyeb apri il servizio e clicca **Redeploy**.
- **Variabili su Koyeb:** `PORT=8000`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://pizzamanager.it` (o il tuo dominio frontend).

### Frontend (Firebase)

- **Cosa fa:** `npm run build` crea la cartella `dist`; `npx firebase deploy --only hosting` (o `npm run deploy`) pubblica il sito su Firebase Hosting.
- **Quando:** dopo modifiche a frontend (src, vite, `.env.production`).
- **Prima del build:** controlla che `.env.production` abbia `VITE_API_URL` con l’URL del backend Koyeb (senza slash finale).
- **Alternativa:** puoi usare `.\deploy-firebase.ps1` o `npm run deploy` (controlla anche `.env.production`).
- **Sito:** https://pizzamanager.it (se il dominio è configurato in Firebase).

### Database (Supabase)

- **Non si fa da terminale:** apri **Supabase** → progetto → **SQL Editor** ed esegui lo script necessario.
- **Quando:** dopo modifiche allo schema (nuove tabelle/colonne/viste/trigger).
- **Script:** schema completo (reset) → `sql/schema_completo_pizzamanager.sql` (FASE 1 fa DROP); solo integrazioni → `server/pizzeria-backend/prisma/schema_integrazioni.sql`.

---

## Riepilogo

| Cosa hai modificato   | Cosa eseguire                                      |
|----------------------|----------------------------------------------------|
| Solo backend         | Blocco git (add/commit/push)                       |
| Solo frontend        | `npm run deploy` oppure `npm run build` + `npx firebase deploy --only hosting` |
| Backend + frontend   | Blocco git (add/commit/push) + `npm run deploy` (vedi sezione sopra)            |
| Solo DB/SQL          | Supabase SQL Editor (nessun comando in VS Code)    |

---

## Riferimenti

- **Guida dettagliata deploy:** `DEPLOY.md`
- **Punto della situazione:** `PUNTO_SITUAZIONE_ENTERPRISE.md`
