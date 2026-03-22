# Comandi per il deploy dell’intero progetto

---

## Deploy completo (copia e incolla)

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git add .
git commit -m "Deploy"
git push
npm run deploy
```

- **git add / commit / push** → aggiorna il repo su GitHub e avvia il build/deploy del backend su Koyeb.
- **npm run deploy** → build del frontend e pubblicazione su Firebase Hosting (https://pizzamanager.it).

---

## Spiegazione

### Backend (Koyeb)

- **Cosa fa:** `git push` invia il codice (incluso `server/pizzeria-backend`) su GitHub. Koyeb è collegato al repo e avvia il build/deploy in automatico.
- **Se il deploy non parte:** in Koyeb apri il servizio e clicca **Redeploy**.
- **Variabili su Koyeb:** `PORT=8000`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://pizzamanager.it` (o il tuo dominio frontend).

### Frontend (Firebase)

- **Cosa fa:** `npm run deploy` esegue build (cartella `dist`) e pubblica su Firebase Hosting.
- **Prima del deploy:** verifica che `.env.production` abbia `VITE_API_URL` con l’URL del backend Koyeb (senza slash finale).
- **Sito:** https://pizzamanager.it (se il dominio è configurato in Firebase).

---

## Database (Supabase)

Il deploy di schema e dati non si fa da terminale: apri **Supabase** → **SQL Editor** ed esegui lo script necessario (es. `sql/schema_completo_pizzamanager.sql` o `server/pizzeria-backend/prisma/schema_integrazioni.sql`).

---

## Riferimenti

- **Guida dettagliata deploy:** `DEPLOY.md`
- **Guida utente Super Admin (console piattaforma):** `docs/GUIDA_SUPERADMIN.md`
- **Punto della situazione:** `PUNTO_SITUAZIONE_ENTERPRISE.md`
