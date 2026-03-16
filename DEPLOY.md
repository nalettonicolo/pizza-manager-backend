# Deploy: backend su Koyeb, frontend su Firebase

Backend su **Koyeb** (GitHub), frontend su **Firebase Hosting** (tuo dominio).

---

## Comandi da dare in VS Code (terminale)

Apri il terminale in VS Code (`` Ctrl+` `` oppure View → Terminal). Dalla **root del progetto** (`PizzaManagerApp`).

**Come verificare se il repo Git è già inizializzato**

Esegui:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git status
```

- Se vedi **"fatal: not a git repository"** (o "not a git repository") → il repo **non** è inizializzato: usa i comandi del primo blocco sotto.
- Se vedi **"On branch main"** (o altro branch), elenco di file, "nothing to commit" / "Changes to be committed" → il repo **è** già inizializzato: usa i comandi del secondo blocco per aggiornare e pushare.

In alternativa: nella root del progetto controlla se esiste la cartella **`.git`** (nascosta). Se non c’è, il repo non è inizializzato.

---

**Se il repo Git non è ancora inizializzato:**

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git init
git add .
git commit -m "Deploy backend Koyeb"
git branch -M main
git remote add origin https://github.com/nalettonicolo/pizza-manager-backend.git
git push -u origin main
```

**Se il repo esiste già e devi solo aggiornare (es. dopo aver modificato Dockerfile.koyeb):**

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git add .
git commit -m "Fix Dockerfile.koyeb multi-stage, DEPLOY.md, .gitignore, .gitattributes"
git push
```

Poi su Koyeb clicca **Redeploy**.

---

## Pulizia totale e deploy da zero (GitHub + Koyeb)

Se vuoi eliminare tutto e rifare il deploy del backend da zero (niente cache, nessun servizio vecchio).

### 1. Pulizia su Koyeb

1. Vai su [app.koyeb.com](https://app.koyeb.com) e accedi.
2. Apri il **servizio** (o l’**app**) che usa il backend.
3. Vai in **Settings** (in basso nella sidebar) → scorri fino a **Danger zone** (o **Delete**).
4. Clicca **Delete service** (o **Delete app**) e conferma.  
   In questo modo il servizio e le immagini associate vengono rimossi; al prossimo deploy non ci sarà cache.

### 2. Pulizia su GitHub (stesso repo, storia resettata)

Per **tenere** il repo `nalettonicolo/pizza-manager-backend` ma ripartire con un solo commit pulito (niente storia vecchia):

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git checkout --orphan temp-main
git add .
git commit -m "Deploy backend Koyeb (pulizia totale)"
git branch -D main
git branch -m main
git push -f origin main
```

Attenzione: **`git push -f`** riscrive la storia su GitHub. Chiunque abbia clonato il repo dovrà rifare un clone o adeguare il proprio `main`.

**Alternativa: nuovo repo su GitHub**

1. Su [github.com](https://github.com) crea un **nuovo** repository (es. `pizza-manager-backend-new`), vuoto, senza README.
2. In locale rimuovi il remote vecchio e aggiungi quello nuovo, poi push:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
git remote remove origin
git remote add origin https://github.com/nalettonicolo/NUOVO-REPO.git
git push -u origin main
```

Sostituisci `NUOVO-REPO` con il nome del nuovo repo.

### 3. Deploy da zero su Koyeb

Dopo la pulizia (e dopo aver fatto push del codice su GitHub, se hai usato l’alternativa con nuovo repo):

1. **Koyeb** → **Create App** (o **New App**).
2. **GitHub** → autorizza se richiesto → scegli il repository (es. `pizza-manager-backend`) e branch **main**.
3. **Builder**: **Dockerfile**.
4. Nella sezione **Customize Dockerfile settings**:
   - **Work directory**: attiva **Override** e inserisci **`server/pizzeria-backend`** (cartella del repo da cui parte il build).
   - **Dockerfile location**: attiva **Override** e inserisci **`Dockerfile.koyeb`** (solo il nome del file, perché il contesto è già la Work directory).
   - **Entrypoint**, **Command**, **Target**: lascia **Override disattivato** (usa i valori del Dockerfile).
5. **Port**: **8000** (nella configurazione del servizio, se richiesto).
6. **Environment variables**:
   `PORT` = **8000**
   `DATABASE_URL` = (connection string Postgres Supabase)
   `JWT_SECRET` = (stringa segreta lunga)
   `CORS_ORIGIN` = **https://pizzamanager.it**
8. **Deploy** → attendi il build (nessuna cache) e che lo stato diventi **Running**.
9. Copia l’URL del servizio (es. `https://xxx.koyeb.app`) e usalo in **VITE_API_URL** per il frontend.

---

## 1. Codice su GitHub

Repo con tutto il progetto, branch **main**. In `server/pizzeria-backend` devono esserci: `Dockerfile.koyeb`, `package.json`, `prisma/`, `src/`.

---

## 2. Koyeb: crea il servizio

1. [koyeb.com](https://www.koyeb.com) → **Continue with GitHub** → autorizza.
2. **Create App** → sorgente **GitHub** → scegli repo e branch **main** → Next.
3. **Build** → **Customize Dockerfile settings** (nomi esatti nell’interfaccia Koyeb):
   - **Work directory**: attiva **Override** → inserisci **`server/pizzeria-backend`**
   - **Dockerfile location**: attiva **Override** → inserisci **`Dockerfile.koyeb`**
   - **Entrypoint**, **Command**, **Target**: lascia Override **disattivato**
   - **Port** (nella config del servizio): **8000**
4. **Environment variables** → aggiungi:

   | Nome            | Valore |
   |-----------------|--------|
   | `PORT`          | `8000` |
   | `DATABASE_URL`  | Connection string Postgres (Supabase → Settings → Database) |
   | `JWT_SECRET`    | Stringa segreta lunga e casuale |
   | `CORS_ORIGIN`   | `https://pizzamanager.it` (il tuo sito frontend) |

5. **Deploy** → attendi “Running” → copia l’URL (es. `https://xxx.koyeb.app`).

---

## Guida dettagliata: compilare la pagina di deploy Koyeb

Segui i passi nell’ordine in cui compaiono nella schermata (dall’alto verso il basso). Ogni blocco può avere un’icona **Ctrl + numero** per aprirlo.

---

### 1. Service type

- **Valore da selezionare:** **Web service** (icona globo).
- Significa che l’app espone un servizio HTTP e Koyeb assegnerà un URL pubblico.

---

### 2. Source

- Clicca sul blocco **Source** per modificarlo.
- **GitHub**: connetti/autorizza il tuo account se richiesto.
- **Repository:** seleziona **`nalettonicolo/pizza-manager-backend`** (o il nome del tuo repo).
- **Branch:** **`main`**.
- Conferma. In questo modo Koyeb userà il codice da quel repo e branch.

---

### 3. Builder

- **Valore:** **Dockerfile** (icona Docker).
- Poi apri **Customize Dockerfile settings** (o la sezione Build/Advanced):
  - **Work directory**: attiva **Override** (toggle ON) e nel campo scrivi **`server/pizzeria-backend`**.
  - **Dockerfile location**: attiva **Override** e scrivi **`Dockerfile.koyeb`**.
  - **Entrypoint**, **Command**, **Target**: lascia **Override disattivato** e i campi vuoti.
- Salva/Applica se richiesto.

---

### 4. Environment variables and files

- Clicca sul blocco **Environment variables and files** (se vedi “No variables, no files”).
- Clicca **Add variable** (o **Add secret**) e aggiungi **una variabile per volta**:

| Nome (Key)   | Valore (Value) / Note |
|--------------|------------------------|
| `PORT`       | `8000`                 |
| `DATABASE_URL` | La connection string Postgres (Supabase → Project Settings → Database → Connection string URI). Usa la modalità “Transaction” o “Session” se indicata. |
| `JWT_SECRET` | Una stringa lunga e casuale (es. generata da un password manager). Non usare password reali. |
| `CORS_ORIGIN`| `https://pizzamanager.it` (senza slash finale) |

- Salva. La sezione non deve più mostrare “No variables”.
- **Files**: lascia vuoto (non servono file aggiuntivi).

---

### 5. Instance

- Clicca sul blocco **Instance**.
- **Piano:** **Free** (0.1 vCPU, 512MB RAM, 2000MB Disk).
- **Region:** scegli una regione vicina (es. **Eco Frankfurt**). Va bene anche un’altra “Eco” nella stessa area.
- Conferma. Per il backend NestJS il piano Free è sufficiente per iniziare.

---

### 6. Scaling

- **Valore consigliato:** **Autoscaling (0–1 instances/region)**.
- Significa: può andare a 0 istanze quando non c’è traffico e tornare a 1 quando arriva una richiesta (possibile cold start di qualche secondo).
- Se preferisci sempre un’istanza attiva, imposta **1–1** (min e max 1); in genere non è disponibile sul piano Free.

---

### 7. Volumes

- Lascia **No volumes configured**.
- Il backend non scrive file sul disco; il database è su Supabase, quindi non servono volumi.

---

### 8. Ports

- Clicca sul blocco **Ports** (es. “1 configured”).
- Deve esserci **una porta** configurata: **8000** (TCP).
- Se la pagina chiede “Application port” o “Port”, inserisci **8000**.
- Salva. Il health check (punto 9) userà questa porta.

---

### 9. Health checks

- **Valore consigliato:** **TCP health check on port 8000**.
- Koyeb controlla che l’app sia in ascolto sulla porta 8000. Non serve configurare un path HTTP se non richiesto.
- Se c’è un campo “Path” per HTTP health check, puoi lasciarlo vuoto o usare `/api` se preferisci un check HTTP.

---

### 10. Service name

- **Valore:** **`pizza-manager-backend`** (o un nome a piacere, senza spazi).
- Questo nome compare nell’URL del servizio, es. `https://pizza-manager-backend-xxx.koyeb.app`.

---

### 11. Deploy

- Controlla che **Environment variables** non sia più “No variables” e che **Port** sia 8000.
- Clicca il pulsante verde **Deploy**.
- Attendi che lo stato passi da **Building** a **Running** (può richiedere alcuni minuti).
- Quando è **Running**, copia l’URL del servizio (es. dall’header o dalla scheda del servizio) e usalo come **VITE_API_URL** nel frontend (senza slash finale).

---

## 3. Se il deploy va in Error (No active deployment)

Koyeb mostra **“An error occurred while deploying your application”**. Controlla in ordine:

1. **Deployment logs**  
   Servizio → **Logs** (o **Deployments** → clic sull’errore → log). Il messaggio preciso indica la causa.

2. **“The command to launch your application is not defined”**  
   - In **Settings** del servizio verifica che non ci sia un campo **Run command** / **Start command** vuoto che sovrascrive il Dockerfile. Se c’è, lascialo vuoto o imposta `node dist/main.js`.  
   - Verifica che la variabile **PORT** sia **8000** (l’app NestJS usa `process.env.PORT`).

3. **“Your application failed to pass the initial health checks”**  
   - L’app deve rispondere sulla porta **8000**. Controlla che **DATABASE_URL** sia corretta (Supabase: Connection string URI).  
   - Se il DB non è raggiungibile o l’avvio fallisce, i health check falliscono. Controlla i log per errori Prisma o connessione.

4. **Build ok ma deploy in Error**  
   - Controlla sempre i **deployment logs** per il messaggio esatto.  
   - Verifica che in locale il backend parta con `PORT=8000` (in `server/pizzeria-backend`: `$env:PORT=8000; npm run start:prod`).

5. **"Cannot find module '/app/dist/main.js'"**  
   L’immagine in esecuzione non contiene `dist/`. Su Koyeb è probabile che venga usata una **vecchia immagine in cache** (build precedente).  
   - Nel **Dockerfile.koyeb** sono stati aggiunti controlli: il build fallisce se `dist/main.js` non esiste (così non si pubblica un’immagine senza dist).  
   - **Cosa fare**: su Koyeb vai nel servizio → **Settings** (o **Build**) → cerca **Clear build cache** / **Rebuild without cache** e avvia un nuovo deploy. Poi fai **Redeploy**.  
   - Verifica che sul repo GitHub ci sia l’ultima versione del **Dockerfile.koyeb** (multi-stage con Node 20) e che il build su Koyeb **non** sia fallito (se fallisce, controlla i log del build).

---

## 4. Errore “Dockerfile.koyeb: no such file or directory”

Se nei log vedi: `open server/pizzeria-backend/Dockerfile.koyeb: no such file or directory`:

- **Work directory** deve essere **`server/pizzeria-backend`** (Override attivo).
- **Dockerfile location** deve essere **solo** **`Dockerfile.koyeb`** (niente `server/...`). Salva e **Redeploy**.

---

## 6. Frontend (Firebase)

1. Nella root del progetto imposta l’URL del backend (es. in `.env.production`):  
   `VITE_API_URL=https://TUO-URL.koyeb.app` (URL del backend Koyeb, senza slash finale).
2. Poi: `npm run build` → `firebase deploy --only hosting`.  
   Il frontend è già online su **https://pizzamanager.it**.

**Comandi da terminale (dalla root `PizzaManagerApp`):** vedi **[DEPLOY_COMANDI.md](DEPLOY_COMANDI.md)** per il riepilogo unico (backend, frontend, DB).

---

## Verifica deploy Firebase

Esegui questi passi dalla **root** del progetto (`PizzaManagerApp`).

**Prima del build**

1. **URL del backend**  
   Crea o modifica `.env.production` nella root (puoi copiare da `.env.production.example`).  
   Imposta **`VITE_API_URL`** con l’URL del servizio Koyeb (es. `https://pizzeria-backend-xxx.koyeb.app`), **senza** slash finale.  
   Copia da `.env` le altre variabili: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` (se usata).

2. **Firebase**  
   Verifica che `.firebaserc` abbia il progetto corretto (es. `pizzeria-da-nicolo`) e che `firebase.json` punti a `"public": "dist"`.

**Build e deploy**

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
npm run build
firebase deploy
```

**Dopo il deploy**

1. Apri **https://pizzamanager.it** (o l’URL indicato da Firebase).
2. Fai login e usa una pagina che chiama l’API (es. turni, ordini). Apri gli **Strumenti per sviluppatori** (F12) → scheda **Rete** (Network): le richieste verso il backend devono andare all’URL impostato in `VITE_API_URL` (il dominio Koyeb) e restituire 200 (o 201), non errori CORS o 404.
3. Se vedi errori CORS, controlla su Koyeb che **CORS_ORIGIN** sia esattamente `https://pizzamanager.it`.

**Riepilogo comandi**

| Azione        | Comando |
|---------------|--------|
| Build frontend | `npm run build` |
| Deploy Firebase | `firebase deploy` |
| Solo hosting   | `firebase deploy --only hosting` |

**Script dalla root:** `.\deploy-firebase.ps1` — controlla `.env.production`, esegue build e `firebase deploy --only hosting`.

---

## Dominio personalizzato (pizzamanager.it)

Il sito è servito su **https://pizzamanager.it**. La configurazione del dominio si fa nella **Firebase Console**, non nel codice.

1. Vai su [Firebase Console](https://console.firebase.google.com) → progetto **pizzeria-da-nicolo**.
2. **Hosting** → **Aggiungi dominio personalizzato** (o verifica dominio).
3. Inserisci **pizzamanager.it** (e eventualmente **www.pizzamanager.it**).
4. Firebase mostra i record DNS da aggiungere (tipo A o CNAME). Aggiungili nel pannello del tuo registrar (dove hai acquistato il dominio).
5. Attendi la verifica (può richiedere qualche ora). Quando è attiva, il deploy con `firebase deploy --only hosting` pubblica su **pizzamanager.it**.

Il file **firebase.json** è già impostato con `"public": "dist"` e le rewrite per la SPA; non serve modificarlo per il dominio.

---

## 7. Variabili

| Dove     | Variabile              | Obbligatorio |
|----------|------------------------|--------------|
| Koyeb    | `PORT`                 | `8000` |
| Koyeb    | `DATABASE_URL`         | Sì |
| Koyeb    | `JWT_SECRET`           | Sì |
| Koyeb    | `CORS_ORIGIN`          | Sì → `https://pizzamanager.it` |
| Frontend | `VITE_API_URL`         | Sì (URL backend) |
| Frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Sì |
