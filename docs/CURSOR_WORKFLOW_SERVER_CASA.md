# Cursor + server casa — workflow collegato

Per lavorare sul codice **sul server Ubuntu** (es. `ServerCasaNaletto`, `~/progetti/PizzaManagerApp`) con la stessa esperienza di modifica, terminale e agente AI:

## 1. Remote SSH (consigliato)

1. Sul **PC Windows**: file `C:\Users\nicol\.ssh\config` con host alias (es. `servercasa`), `HostName` = IP LAN, `User nicolo`, `IdentityFile` verso la chiave ed25519.
2. **Cursor** → `Ctrl+Shift+P` → **Remote-SSH: Connect to Host** → scegli l’alias.
3. **File → Open Folder** → `/home/nicolo/progetti/PizzaManagerApp` (o il path reale del clone sul server).

In quella finestra **terminale, Git e Agent** operano **sul server**. Le chat Composer/Agent restano associate al **workspace** (qui URI remoto): non è lo stesso storico della cartella `D:\...` aperta in locale.

## 2. Workflow preferito: **solo locale** → GitHub → server (consigliato per te)

1. **Cursor**: una finestra aperta sul repo **locale** (`D:\APP_PIZZERIA\PizzaManagerApp`) — qui fai sviluppo e commit.  
2. **GitHub**: `git push` sul branch che il server traccia (es. `main`).  
3. **Server**: aggiorni il clone con `git pull` e, se serve, rebuild/restart backend.

Non serve la seconda finestra SSH per ogni modifica: usala solo quando vuoi **debuggare sul server** o vedere log/servizi.

### Script automatico (dalla root del repo, PowerShell)

Dopo aver **committato** le modifiche:

```powershell
npm run sync:server
```

Fa in automatico sul server, in sequenza:

1. **`git push`** (GitHub)  
2. **SSH** → `git pull --ff-only` in `~/progetti/PizzaManagerApp`  
3. **`npm run build`** in `server/pizzeria-backend`  
4. **`sudo systemctl restart pizzamanager-api`**

Ti chiederà la **passphrase** SSH (se usi chiave) e, al passo `sudo`, la **password** dell’utente sul server (a meno che `sudo` NOPASSWD sia già configurato per quel comando).

Solo **aggiornare il codice** sul server **senza** rebuild/restart backend (es. hai cambiato solo doc o il frontend lo pubblichi altrove):

```powershell
npm run sync:server:pull
```

Parametri utili (avanzato):

```powershell
.\scripts\sync-to-server.ps1 -SshHost servercasa -RemotePath "~/progetti/PizzaManagerApp"
.\scripts\sync-to-server.ps1 -NoPush                    # pull + build + restart (push già fatto)
.\scripts\sync-to-server.ps1 -NoPush -SkipBackend       # solo pull
```

**Nota:** il server deve avere già configurato `git` verso GitHub (SSH key o token) per `git pull` senza prompt interattivo.

**Vetrina via Nest (senza cambiare auth):** in `.env` / `.env.production` del frontend, `VITE_PUBLIC_STOREFRONT_VIA_NEST=true` attiva menu + categorie + ingredienti pubblici verso `/api/public/menu/*` (richiede `VITE_API_URL`). Solo tenant da Nest: `VITE_PUBLIC_TENANT_VIA_NEST=true` senza storefront.

## 3. DNS domestico (Telecom / homenet)

Se un nome host breve risolve a `127.0.0.1`, **non** usarlo come `Host` SSH: usa **IP LAN** in `HostName` oppure un alias che non collida (vedi guida passo-passo già usata in sede).

## 4. Alternativa manuale (senza npm script)

Stesso flusso del §2 senza script: `git push` da locale, poi sul server `git pull` e comandi di build/restart come da `txt.txt` / `DEPLOY_COMANDI.md`.

## 5. Cosa non aspettarsi

- **Nessun tunnel automatico** tra “Cursor cloud” e il tuo server senza SSH o senza un servizio esplicito che tu configuri.
- **Segreti** (`.env`, chiavi DB): restano sul server o in vault; non versionare.

---

*Riferimenti deploy: `DEPLOY_COMANDI.md`, rete `docs/FASE_0_RETE_SELFHOST.md`.*
