# Fase 0 — Rete pubblica sicura (Postgres a casa + API Nest)

Obiettivo: il **sito e le API** sono raggiungibili da Internet con **HTTPS**; **PostgreSQL resta in rete privata** (stesso server o LAN), **senza** porta 5432 esposta sul modem verso il mondo.

Riferimento stack Nest: prefisso globale `api` (`server/pizzeria-backend/src/main.ts`), porta default `3001` se non imposti `PORT`.

---

## Step 0.1 — Inventario (5 min)

| Elemento | Valore tipico (adatta ai tuoi) |
|----------|-------------------------------|
| Server Ubuntu | es. `ServerCasaNaletto`, IP LAN `192.168.1.53` |
| IP pubblico casa | dinamico → serve DDNS (Step 0.3) |
| Dominio | es. `api.tuodominio.it` → solo backend; frontend può restare su Firebase/Vercel |
| Nest in ascolto | `127.0.0.1:3001` dietro reverse proxy (consigliato) o `0.0.0.0:3001` solo se firewall chiude tutto tranne proxy |

Segna da parte cosa userai: **percorso A (Caddy/Nginx sul server)** o **percorso B (Cloudflare Tunnel, senza aprire porte sul router)**.

---

## Step 0.2 — PostgreSQL: non esporlo su Internet

1. **Router domestico**: **non** fare port forwarding della **5432** verso l’esterno. Se l’hai già fatto, rimuovilo.
2. **`postgresql.conf`**: per massima sicurezza verso Internet, fai in modo che Postgres accetti connessioni solo dove ti serve:
   - **Stesso host:** `listen_addresses = 'localhost'` se Nest e Postgres girano sulla **stessa** macchina Ubuntu e tutti i client DB sono locali.
   - **LAN:** `listen_addresses = '192.168.1.53'` (solo IP del server) se altri PC in casa devono usare pgAdmin verso quel nodo — comunque **mai** 5432 sul WAN.
3. **`pg_hba.conf`**: evita regole `0.0.0.0/0` verso Internet. Mantieni:
   - `127.0.0.1/32` per localhost;
   - eventually `192.168.1.0/24` per LAN se serve pgAdmin da altri PC;
   - **non** `0.0.0.0/0` se la 5432 è raggiungibile dal modem (anche per errore).

Riavvia Postgres dopo le modifiche:

```bash
sudo systemctl restart postgresql
```

---

## Step 0.3 — DNS e IP dinamico

1. Ottieni un **nome host** (es. `api.tuodominio.it`) nel tuo DNS.
2. Se l’IP pubblico cambia, configura **DDNS** (router, script `ddclient`, o provider tipo DuckDNS/Cloudflare API) così il nome punta sempre alla tua casa.

Verifica da fuori (da cellulare in 4G o da `dig`):

```bash
dig +short api.tuodominio.it
```

Deve risolvere all’IP pubblico attuale della connessione casa.

---

## Step 0.4 — Router: solo HTTPS (percorso A)

Sul router, **port forwarding**:

| Porta WAN | Porta LAN | Destinazione |
|-----------|-----------|----------------|
| 80 | 80 | IP Ubuntu del server (es. `192.168.1.53`) |
| 443 | 443 | stesso |

**Non** inoltrare 5432, 22 (meglio VPN/Tailscale per SSH amministrativo se puoi).

---

## Step 0.5 — Firewall sul server Ubuntu

```bash
sudo ufw status verbose
```

Regola minima consigliata (dopo aver abilitato SSH per non rimanere fuori):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Opzionale: **non** aprire `5432/tcp` su UFW verso la zona pubblica; se Postgres è solo `localhost`, non serve regola WAN.

---

## Step 0.6 — Percorso A — Caddy (HTTPS automatico)

Installazione:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Copia il template dal repo `infra/selfhost/Caddyfile.example` in `/etc/caddy/Caddyfile` (adatta dominio e porta Nest).

Esempio minimale (sostituisci il dominio):

```text
api.tuodominio.it {
    reverse_proxy 127.0.0.1:3001
}
```

Valida e riavvia:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Test:

```bash
curl -sI https://api.tuodominio.it/api
```

(Atteso `401`/`404` JSON se non hai route root — l’importante è **TLS OK** e il proxy raggiunge Nest.)

---

## Step 0.7 — Nest sul server (stesso host del DB)

Sul Ubuntu (Node LTS, es. 20 o 22):

```bash
cd /percorso/clonato/PizzaManagerApp/server/pizzeria-backend
npm ci
```

Backend: configura **`server/pizzeria-backend/.env`** (non in git). Frontend root: **`.env`** (sviluppo) e **`.env.production`** (build deploy).

Variabili essenziali Nest:

```env
PORT=3001
DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/postgres
JWT_SECRET=<stringa-lunga-casuale>
CORS_ORIGIN=https://pizzamanager.it,https://www.pizzamanager.it
```

Avvio servizio (poi potrai usare `systemd`):

```bash
npm run start:prod
```

Per **systemd** user-mode o unit file dedicato: crea un servizio che esegue `node dist/main.js` dopo `npm run build` (documentazione Nest standard).

---

## Step 0.8 — Percorso B — Cloudflare Tunnel (no aperture 443 sul router)

Utile se non vuoi o non puoi fare port forwarding.

1. Account Cloudflare, dominio gestito lì.
2. Installa `cloudflared` sul server Ubuntu (pacchetto ufficiale o binary).
3. `cloudflared tunnel login` → crea tunnel → config YAML che punta a `http://127.0.0.1:3001`.
4. In Cloudflare DNS, record **CNAME** del sottodominio verso `xxxx.cfargotunnel.com`.

In questo modo il traffico pubblico **non** entra sulla 443 del modem verso casa in modo classico; passa dal tunnel. Postgres resta comunque non esposto.

Dettaglio variabile nel tempo: seguire la documentazione corrente Cloudflare “Private/public hostname” per il tunnel.

---

## Step 0.9 — Checklist finale Fase 0

- [ ] 5432 **non** inoltrata sul router verso WAN  
- [ ] `pg_hba` senza accesso mondiale non necessario  
- [ ] HTTPS funziona sul dominio API (`curl -I https://...`)  
- [ ] `DATABASE_URL` usa `127.0.0.1` o IP LAN, **non** IP pubblico  
- [ ] `CORS_ORIGIN` include l’origine reale del frontend in produzione  
- [ ] Frontend deploy: `VITE_API_URL=https://api.tuodominio.it` (senza slash finale), da applicare in **Fasi successive** quando tagli Supabase  

---

## Prossima fase (Fase 1)

Definizione policy RLS vs ruolo Nest e primo endpoint auth unificato; vedi roadmap conversazione architettura. Questo file si limita alla **Fase 0 rete**.
