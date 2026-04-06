# Comandi per il deploy dell’intero progetto

---

## Deploy predefinito (completo: Koyeb + Firebase)

Dopo aver **committato** le modifiche che vuoi in produzione:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
npm run deploy
```

- **`git push`** (primo passo dello script) → invia il codice su GitHub e fa partire il deploy del **backend su Koyeb**.
- Poi **`deploy:hosting`** → `npm run build` e pubblicazione su **Firebase Hosting**.

Solo frontend (nessun push, nessun Koyeb):

```powershell
npm run deploy:hosting
```

---

## Prima volta o commit manuale

Se devi ancora aggiungere e committare:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git add .
git commit -m "Deploy"
npm run deploy
```

---

## Spiegazione

### Backend (Koyeb)

- **Cosa fa:** `git push` (incluso nello script `npm run deploy`) invia il codice (incluso `server/pizzeria-backend`) su GitHub. Koyeb è collegato al repo e avvia il build/deploy in automatico.
- **Se il deploy non parte:** in Koyeb apri il servizio e clicca **Redeploy**.
- **Variabili su Koyeb:** `PORT=8000`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://pizzamanager.it` (o il tuo dominio frontend).

### Frontend (Firebase)

- **Cosa fa:** `npm run deploy:hosting` (o la seconda parte di `npm run deploy`) esegue build (cartella `dist`) e pubblica su Firebase Hosting.
- **Non pubblicare hosting senza build:** non usare da solo `firebase deploy --only hosting` senza build; senza `npm run build` rischi una `dist` incompleta o vecchia. La cartella `dist/` è in `.gitignore` e non va versionata.
- **Prima del deploy:** verifica che `.env.production` abbia `VITE_API_URL` con l’URL del backend Koyeb (senza slash finale).
- **Sito:** https://pizzamanager.it (se il dominio è configurato in Firebase).
- **Guide in app:** **Admin → Manuale** legge `src/content/manualeUtente.md` e `manualeRoadmap.js`. **Super Admin → Documentazione** incorpora al build i file in `docs/*.md` (es. `GUIDA_SUPERADMIN.md`, `GUIDA_ADMIN.md`, `ARCHITETTURA_E_STATO.md`) e `DEPLOY_COMANDI.md`: dopo averli modificati, ridistribuisci il frontend.

---

## Database (Supabase)

Il deploy di schema e dati non si fa da terminale: apri **Supabase** → **SQL Editor** ed esegui lo script necessario. Bootstrap completo: `sql/schema_completo_pizzamanager.sql`. **Incrementale post-baseline** (idempotente): `supabase/migrations/20260406100000_post_remote_schema_unified.sql`. **Solo le modifiche del momento** (file che svuoti e riempi a ogni intervento): `sql/sql_upgrade.sql`. Dopo un progetto nato da dump Supabase: prima `supabase/migrations/20260220171734_remote_schema.sql`, poi la migration incrementale. Backend Prisma: `server/pizzeria-backend/prisma/schema_integrazioni.sql`.

**Checklist dopo `sql_upgrade.sql` (stabilità):** verificare che esistano colonne/viste attese (es. `core.punti_vendita.consegna_area_poligono`, vista `public.punti_vendita` aggiornata). In app: smoke manuale **vetrina** (menù + carrello), **cassa** (ordine test), **admin** (parametri, listini, sedi e aree).

---

## Smoke test post-deploy (manuale)

1. Login admin tenant → **Impostazioni → Parametri** salva senza errori; **Promozioni** visibili.
2. **Menu → Listini e backup**: stampa PDF; con archivio attivo, snapshot JSON e (opzionale) ripristino prezzi da backup.
3. **Impostazioni → Sedi e aree**: mappa per PV salva senza errore RLS.
4. **Vetrina**: prezzi promo se configurati; checkout cliente se abilitato.
5. **Pagamenti online** (Stripe/SumUp): in app restano placeholder finché non si integrano webhook e stati; non fare affidamento su incasso reale senza test ambiente.

---

## Roadmap non inclusa nel codice

- **Versioning listino** con data effetto / rollback completo (DB dedicato).
- **Listino diverso per PV** (stesso listino DB oggi; archivio JSON come backup).
- **Stripe/SumUp end-to-end**, **notifiche push/email** ordini: da progettare per tenant.

---

## Riferimenti

- **Guida dettagliata deploy:** `DEPLOY.md`
- **Guida utente Super Admin (console piattaforma):** `docs/GUIDA_SUPERADMIN.md`
- **Linee guida Admin (tenant):** `docs/GUIDA_ADMIN.md`
- **Architettura e stato (roadmap vs codice):** `docs/ARCHITETTURA_E_STATO.md`
- **Punto della situazione:** `PUNTO_SITUAZIONE_ENTERPRISE.md`
- **Hub guide in console:** `src/features/superadmin/pages/SuperadminGuideHub.jsx` (elenchi slug → `SuperadminGuideDocPage.jsx`)

---

*Ultima revisione documento: 2026-04-05*
