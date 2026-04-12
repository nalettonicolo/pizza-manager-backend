# Migrazione da Supabase a MySQL (server dedicato) e backup

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
