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

**Deploy senza prompt** (CI / script: niente `Read-Host`, Firebase `--non-interactive`; serve già `firebase login` o `FIREBASE_TOKEN`):

```powershell
npm run deploy:hosting:ci
```

Push GitHub + hosting senza prompt intermedio (il push può comunque chiedere credenziali Git se non configurate):

```powershell
npm run deploy:full:ci
```

PowerShell: `.\deploy-firebase.ps1 -NonInteractive`

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

## Database Supabase (schema)

Prima di usare in produzione funzioni che dipendono da RPC/tabelle nuove (turni cassa, ordine↔turno, registratore Super Admin, ecc.):

- **Baseline unico:** tutto lo storico delle migration è consolidato in **`sql/schema_completo_pizzamanager.sql`** (eseguire nel **SQL Editor** Supabase per nuovo ambiente o allineamento completo).
- **Solo patch successive al baseline:** aggiungere ed eseguire **`sql/sql_upgrade.sql`** (script incrementale idempotente).
- **`supabase db push`:** la cartella `supabase/migrations/` non contiene più file `.sql` consolidati; per usare la CLI serve rigenerare migration da diff (`supabase db diff`) o ripristinare file dedicati al team. Flusso consigliato finché non si reintroducono migration: **SQL Editor** con gli script sopra.

Verificare che non ci siano errori se `punti_vendita` è una VIEW (FK saltati) quando si applicano patch che toccano FK.

Stato backlog e priorità engineering: **`docs/BACKLOG_E_STATO_SVILUPPO.md`**.

---

## Spiegazione

### Backend (Koyeb)

- **Cosa fa:** `git push` (incluso nello script `npm run deploy`) invia il codice (incluso `server/pizzeria-backend`) su GitHub. Koyeb è collegato al repo e avvia il build/deploy in automatico.
- **Se il deploy non parte:** in Koyeb apri il servizio e clicca **Redeploy**.
- **Variabili su Koyeb:** `PORT=8000`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://pizzamanager.it` (o il tuo dominio frontend).

### Frontend (Firebase)

- **Cosa fa:** `npm run deploy:hosting` (o la seconda parte di `npm run deploy`) esegue build (cartella `dist`) e pubblica su Firebase Hosting.
- **Non pubblicare hosting senza build:** non usare da solo `firebase deploy --only hosting` senza build; senza `npm run build` rischi una `dist` incompleta o vecchia. La cartella `dist/` è in `.gitignore` e non va versionata.
- **Prima del deploy:** nella root usa il file definitivo **`.env.production`** (gitignored) con `VITE_API_URL` verso Nest (es. Koyeb o `https://api.pizzamanager.it`), senza slash finale; compila anche `VITE_SUPABASE_*` e chiavi necessarie come in quel file.
- **Sito:** https://pizzamanager.it (se il dominio è configurato in Firebase).
- **Guide in app:** **Admin → Manuale** legge `src/content/manualeUtente.md` e `manualeRoadmap.js`. **Super Admin → Documentazione** incorpora al build i file in `docs/*.md` (es. `GUIDA_SUPERADMIN.md`, `GUIDA_ADMIN.md`, `ARCHITETTURA_E_STATO.md`) e `DEPLOY_COMANDI.md`: dopo averli modificati, ridistribuisci il frontend.

---

## Database (Supabase)

Il deploy di schema e dati non si fa da terminale: apri **Supabase** → **SQL Editor**. **Bootstrap / allineamento completo:** `sql/schema_completo_pizzamanager.sql` (include l’ex snapshot remoto e tutte le patch che erano in `supabase/migrations/`). **Solo modifiche dopo quel baseline:** `sql/sql_upgrade.sql`. Backend Prisma: `server/pizzeria-backend/prisma/schema_integrazioni.sql`. Mappa ruoti/API vs Supabase vs backend: **`docs/ARCHITETTURA_API_E_RUOLI.md`**.

**Checklist dopo `sql_upgrade.sql` (stabilità):** verificare che esistano colonne/viste attese (es. `core.punti_vendita.consegna_area_poligono`, vista `public.punti_vendita` aggiornata). In app: smoke manuale **vetrina** (menù + carrello), **cassa** (ordine test), **admin** (parametri, listini, sedi e aree).

---

## Smoke test post-deploy (manuale)

1. Login admin tenant → **Impostazioni → Parametri** salva senza errori; **Promozioni** visibili.
2. **Menu → Listini e backup**: stampa PDF; con archivio attivo, snapshot JSON e (opzionale) ripristino prezzi da backup.
3. **Impostazioni → Area di consegna**: mappa globale e per PV salva senza errore RLS.
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
- **Ruoli, route e flussi dati (Supabase vs `VITE_API_URL`):** `docs/ARCHITETTURA_API_E_RUOLI.md`
- **Self-host Postgres + API Nest, Fase 0 (HTTPS, firewall, niente 5432 su Internet):** `docs/FASE_0_RETE_SELFHOST.md`
- **Fase 1 (URL API in produzione, Nest auth opzionale, systemd):** `docs/FASE_1_AUTH_E_API_SELFHOST.md` — template servizio: `infra/selfhost/pizzamanager-api.service.example`
- **Punto della situazione (stack / deploy):** `PUNTO_SITUAZIONE_ENTERPRISE.md`
- **Punto della situazione (visione webapp completa):** `docs/PUNTO_SITUAZIONE_WEBAPP_COMPLETA.md`
- **Hub guide in console:** `src/features/superadmin/pages/SuperadminGuideHub.jsx` (elenchi slug → `SuperadminGuideDocPage.jsx`)

---

*Ultima revisione documento: 2026-04-10*
