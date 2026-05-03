# Cursor + server casa — workflow collegato

Per lavorare sul codice **sul server Ubuntu** (es. `ServerCasaNaletto`, `~/progetti/PizzaManagerApp`) con la stessa esperienza di modifica, terminale e agente AI:

## 1. Remote SSH (consigliato)

1. Sul **PC Windows**: file `C:\Users\nicol\.ssh\config` con host alias (es. `servercasa`), `HostName` = IP LAN, `User nicolo`, `IdentityFile` verso la chiave ed25519.
2. **Cursor** → `Ctrl+Shift+P` → **Remote-SSH: Connect to Host** → scegli l’alias.
3. **File → Open Folder** → `/home/nicolo/progetti/PizzaManagerApp` (o il path reale del clone sul server).

In quella finestra **terminale, Git e Agent** operano **sul server**. Le chat Composer/Agent restano associate al **workspace** (qui URI remoto): non è lo stesso storico della cartella `D:\...` aperta in locale.

## 2. DNS domestico (Telecom / homenet)

Se un nome host breve risolve a `127.0.0.1`, **non** usarlo come `Host` SSH: usa **IP LAN** in `HostName` oppure un alias che non collida (vedi guida passo-passo già usata in sede).

## 3. Alternativa: solo Git

Sviluppo su `D:\APP_PIZZERIA\PizzaManagerApp` → `git push` → sul server `git pull` e `npm run build` / `systemctl restart ...`. L’agente in Cursor usa il workspace **locale**; il server si aggiorna via Git.

## 4. Cosa non aspettarsi

- **Nessun tunnel automatico** tra “Cursor cloud” e il tuo server senza SSH o senza un servizio esplicito che tu configuri.
- **Segreti** (`.env`, chiavi DB): restano sul server o in vault; non versionare.

---

*Riferimenti deploy: `DEPLOY_COMANDI.md`, rete `docs/FASE_0_RETE_SELFHOST.md`.*
