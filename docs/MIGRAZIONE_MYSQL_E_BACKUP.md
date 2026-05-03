# Migrazione da Supabase a MySQL (server dedicato) e backup

Guida operativa unificata (SQL workflow, deploy, checklist): **`docs/GUIDA_OPERATIVITA_SQL_MYSQL_DEPLOY.md`**.

Per spostare il **database** da **Supabase Postgres (hosted)** a un **PostgreSQL dedicato** (stesso dialetto SQL, Prisma resta `postgresql`), vedi **`docs/MIGRAZIONE_SUPABASE_A_POSTGRES.md`**. Il presente file resta focalizzato sul percorso **MySQL** e sulle implicazioni (cambio provider, niente RLS nativa uguale, ecc.).

## Perché farlo

- **Backup pianificati** sotto il tuo controllo (mysqldump, Percona XtraBackup, replica).
- **Nessun limite** del piano SaaS del provider attuale.
- **Data residency** e contratti con il tuo HSP.

## Cosa si perde / si deve sostituire

| Capacità Supabase | Equivalente tipico su stack “tutto tuo” |
|-------------------|----------------------------------------|
| Auth + JWT | Servizio auth dedicato + refresh token + rotazione chiavi |
| PostgREST (REST auto) | API **Nest/Express** esplicite + OpenAPI |
| RLS Postgres | **Autorizzazione applicativa** + DB user least privilege + stored proc |
| Realtime | WebSocket / SSE / polling |
| Edge Functions | Worker Node / queue |
| Storage file | S3-compatible o filesystem + antivirus |

## Crittografia e sicurezza (collegamento “database blindato”)

1. **In transito:** TLS obbligatorio tra app ↔ MySQL e tra client ↔ API.
2. **A riposo:** encryption at rest del volume / TDE del vendor cloud **o** filesystem cifrato sul VPS.
3. **“Crittografia completa del database” in senso stretto:** MySQL Enterprise TDE o cifratura lato filesystem; **cifratura colonna** solo per campi ultra sensibili (PII, token) con gestione chiavi (KMS, Vault) — costo operativo alto.
4. **Backup cifrati:** dump cifrati con chiave separata dal server che ospita il DB.

**Attenzione:** cifrare *tutto* il contenuto in colonna rompe ricerche full-text e indici semplici; si usa in modo selettivo.

## Piano di migrazione (macro-fasi)

1. **Inventario:** elenco tabelle/viste/RPC/Edge usate dal frontend (`adminService`, `publicService`, ecc.).
2. **Strato API:** ogni lettura/scrittura critica passa dal **backend** (già presente opzionale con `VITE_API_URL`); il client non parla più diretto al DB per quelle operazioni.
3. **Schema MySQL:** traduzione tipi, indici, vincoli; **niente RLS** → policy nel codice + audit log.
4. **Doppia scrittura o freeze:** periodo in cui si scrive su entrambi i sistemi o si congela feature.
5. **Cutover + rollback:** piano di tornare indietro (snapshot DB).

## Backup (esempi operativi MySQL)

- `mysqldump` giornaliero + retention 30g; verifica restore mensile.
- Replica asincrona verso secondo nodo (DR).
- **Non** sostituisce audit applicativi (chi ha modificato cosa).

## Stato attuale repository

L’applicazione **è integrata con Supabase**. Questo documento è **roadmap**; non rimuove Supabase dal codice finché le fasi sopra non sono approvate e finanziate.

---

## Preparazione server personale MySQL su PC industriale (on‑prem)

Obiettivo: **massima operabilità** locale (backup, manutenzione, assenza vincoli piano cloud) con **svincolo temporaneo** da Supabase *come unico motore dati*: si lavora per fasi; in parallelo il codice attuale resta Supabase‑centric finché non esiste uno strato API completo.

### Hardware / sistema (linee guida)

- **Risorse minime consigliate** per MySQL 8 + API Node + reverse proxy: RAM adeguata al dataset e alle connessioni (pianificare margine per picchi cassa), SSD NVMe, rete stabile (cavo), **UPS** se il locale è in produzione.
- **OS**: Linux LTS (es. Debian/Ubuntu Server) tipicamente più semplice per servizi sempre accesi e aggiornamenti; oppure Windows Server se l’integrazione con altri sistemi del locale lo richiede — in entrambi i casi **firewall** solo porte necessarie (HTTPS verso API, MySQL **non** esposto su Internet senza VPN).
- **TLS**: certificato valido (anche interno/PKI) tra client browser/tablet e API; tra API e MySQL TLS o rete fidata isolata.

### Stack dati on‑prem (cosa installare sul PC industriale)

1. **MySQL 8.x** (Community o build supportata), `utf8mb4`, timezone e orologio sistema sincronizzati (NTP).
2. **Process manager** per l’API (es. `systemd`, PM2, NSSM su Windows) — restart automatico.
3. **Reverse proxy** (nginx, Caddy, IIS+ARR) davanti all’API: HTTPS, rate limit basilare, header sicurezza.
4. **Backup**: `mysqldump` o snapshot volume + **prova di restore** documentata; copia su disco esterno o NAS secondo policy del locale.

### “Svincolare momentaneamente Supabase”: cosa significa in pratica

Supabase oggi non è solo Postgres: è **Auth**, **PostgREST**, **RLS**, **Realtime**, **Storage**, **Edge Functions**. Spostare il DB su MySQL **non** sostituisce automaticamente queste parti.

| Voce | Per operare senza Supabase come DB |
|------|-------------------------------------|
| **Dati** | Schema MySQL derivato da `sql/schema_completo_pizzamanager.sql` (traduzione tipi/vincoli/indici); niente RLS → regole nel **backend** + utenti DB least privilege. |
| **Accesso dalla SPA** | La React app oggi usa `@supabase/supabase-js` ovunque: serve **strato API** (es. Nest già presente in `server/pizzeria-backend`) che espone le stesse operazioni con **JWT/session** emessi dal server, non da Supabase Auth. |
| **Auth** | Migrazione utenti/password/link reset; oppure periodo di **convivenza** (solo letture da MySQL per test) — da decidere per tenant. |
| **Realtime** | Polling o WebSocket sul backend se servono aggiornamenti live (cassa/cucina). |
| **File** | Filesystem locale o MinIO/S3-compatible sullo stesso LAN. |

**Nota tecnica repo:** il backend Nest usa oggi **Prisma + PostgreSQL** (`provider = "postgresql"`, schema `core` in `server/pizzeria-backend/prisma/schema.prisma`). Passare a MySQL implica **cambiare provider**, rimuovere/adeguare `schemas` Postgres e **rigenerare** modelli — non è un semplice cambio di connection string.

### Sequenza consigliata (preparazione sviluppo, basso rischio)

1. **Inventario chiamate** dal frontend: mappare `adminService`, `publicService`, `cassaService`, auth, superadmin → elenco endpoint/RPC necessari (già citato come fase 1 nella roadmap migrazione).
2. **Ambiente di prova** sul PC industriale: MySQL vuoto + API minimale (health + una risorsa lettura) + variabili `VITE_API_URL` / feature flag per puntare solo moduli migrati.
3. **Un dominio funzionale alla volta** (es. magazzino read‑only, poi ordini in sola lettura): finché il cutover non è completo, **produzione può restare Supabase** mentre l’on‑prem è staging/pilota.
4. **Sicurezza**: test multi‑tenant su API (nessun `tenant_id` fidato dal solo client); audit log per operazioni sensibili.

### Definition of Done (fase “preparazione installazione”)

- [ ] MySQL installato, backup/restore verificati su quel PC.
- [ ] API raggiungibile in HTTPS dalla rete locale (o VPN) con documentazione host/porta.
- [ ] Inventario endpoint/RPC firmato e prioritizzato.
- [ ] Decisione esplicita su **convivenza Supabase + MySQL** (solo dev) vs **cutover** (solo dopo parity test).
