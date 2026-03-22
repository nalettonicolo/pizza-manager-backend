# Guida utente — Area Super Admin (PizzaManager)

Documento **vivo**: aggiornalo quando aggiungi o modifichi funzionalità nella console piattaforma. In fondo c’è una sezione **Registro aggiornamenti** da compilare a ogni release rilevante.

---

## 1. Cos’è il Super Admin

Il **Super Admin** gestisce l’intera piattaforma SaaS: tutte le **pizzerie (tenant)** iscritte, i **piani** e la visione d’insieme su **abbonamenti** e volumi.  
È un profilo distinto dal **Admin di pizzeria** (tenant), che vede solo i dati della propria attività.

**URL tipici (ambiente produzione):**

- Sito pubblico / login: `https://pizzamanager.it` (o dominio `app.*` configurato)
- Area Super Admin: `https://pizzamanager.it/superadmin/dashboard` (dopo login)

---

## 2. Accesso

1. Apri la pagina di **login** del progetto SaaS.
2. Accedi con un utente il cui ruolo in database è **superadmin** (tabella `public.utenti_ruoli`, campo `ruolo` = `superadmin`, collegato al tuo `user_id` Supabase).
3. Dopo l’accesso, l’app reindirizza alla **dashboard Super Admin** (`/superadmin/dashboard`).

Se l’accesso funziona ma non vedi l’area Super Admin, verifica in Supabase che il profilo sia presente e attivo in `utenti_ruoli`.

---

## 3. Struttura menu (sidebar e barra)

| Voce | Percorso | Ruolo |
|------|----------|--------|
| Riepilogo | `/superadmin/dashboard` | Panoramica numeri e link rapidi |
| Clienti | `/superadmin/tenants` | Elenco e gestione tenant (pizzerie) |
| Piani | `/superadmin/piani` | Descrizione piani Free / Pro / Enterprise |
| Abbonamenti | `/superadmin/licenses` | Tabella subscription con stato e rinnovi |
| Impostazioni | `/superadmin/settings` | Parametri globali (placeholder / bozza UI) |

---

## 4. Pagine in dettaglio

### 4.1 Riepilogo (`/superadmin/dashboard`)

**Cosa mostra (dati attuali nell’implementazione):**

- **Schede di navigazione** verso le altre sezioni Super Admin.
- **KPI principali:** clienti totali, clienti attivi, numero abbonamenti (righe in `subscriptions`), ordini totali (conteggio dalla tabella usata dal servizio; vedi nota tecnica sotto).
- **Clienti per piano:** distribuzione tenant per piano (`FREE`, `PRO`, `ENTERPRISE`).
- **Abbonamenti per stato:** conteggio subscription per stato (es. Attiva, Scaduta, Sospesa, Cancellata).
- **Ultimi clienti:** elenco sintetico degli ultimi tenant (nome, slug, piano) con link verso la gestione clienti.

**Nota tecnica (ordini):** le statistiche piattaforma leggono i tenant e le subscription da Supabase; il totale ordini dipende dalla tabella/vista configurata nel client (es. `Ordine`). Se il conteggio risulta zero, verificare nome tabella e permessi RLS in Supabase.

---

### 4.2 Clienti — Tenant (`/superadmin/tenants`)

**Funzioni:**

- Visualizzazione elenco **tutti i tenant** (pizzerie) non eliminati (`deleted_at` nullo).
- **Creazione** nuovo cliente: nome, **slug** (identificativo URL-friendly), **piano** (default: prova **TRIAL** / 7 giorni, poi Pro o Enterprise), flag **attivo**.
- **Modifica** cliente esistente: stessi campi.

**Comportamento slug:** in creazione, se lo slug è vuoto può essere derivato dal nome (solo lettere minuscole, numeri e trattini).

**Dati persistiti:** tabella `tenants` (schema `public` o `core`, in base all’installazione; il servizio prova entrambi).

---

### 4.3 Piani (`/superadmin/piani`)

**Funzioni attuali:**

- **Definizione piani commerciali**: per ogni piano puoi impostare nome, prezzo (testo libero), descrizione e **elenco punti** (“cosa include”). Aggiunta, modifica, eliminazione piani.
- Persistenza in **localStorage** del browser (per allineare il team; la pubblicazione su DB/landing globale va estesa in seguito).
- **Nessun piano Free permanente** in prodotto: i nuovi clienti usano la **prova di 7 giorni** (codice piano tipico `TRIAL` sui tenant), poi un abbonamento (es. `PRO`, `ENTERPRISE`).
- Link di navigazione verso altre sezioni Super Admin.

**Codici piano sui tenant** (campo `piano`): `TRIAL`, `PRO`, `ENTERPRISE`; eventuali valori `FREE` in database sono considerati **legacy**.

---

### 4.4 Abbonamenti (`/superadmin/licenses`)

**Funzioni:**

- Tabella delle **subscription** con: cliente, slug, piano, **stato**, data **rinnovo** (`rinnovo_il`), data creazione.
- Stato mostrato con etichette in italiano (Attiva, Scaduta, ecc.).
- Link verso **Clienti** per gestione tenant.

Se non ci sono righe in `subscriptions`, viene mostrato un messaggio esplicativo.

---

### 4.5 Impostazioni (`/superadmin/settings`)

**Funzioni attuali (UI):**

- Blocco **configurazione generale** con nome applicazione (campo di sola lettura / dimostrativo).
- Pulsante **Salva** con feedback simulato (messaggio “Salvato (simulato)”) — utile solo a fini dimostrativi finché non si collega un backend di salvataggio.
- Sezione **Supporto** (URL e email) come campi editabili in pagina, senza persistenza garantita finché non implementata.
- Link alla pagina **Piani**.

**Nota:** aggiornare questa sezione quando le impostazioni globali saranno salvate su API o Supabase.

---

## 5. Operazioni che il Super Admin **non** fa (oggi) nell’UI

Per evitare aspettative errate, queste capacità **non** sono esposte come sezioni dedicate nella console Super Admin al momento della stesura di questa guida:

- Dashboard **MRR / fatturazione SaaS** dettagliata
- **Monitor infrastruttura** (log errori, performance API, utilizzo database)
- **Fatture PDF** e storico pagamenti integrato
- Modifica **prezzi piani** con persistenza centralizzata (la pagina Piani è descrittiva)

Quando una di queste viene implementata, aggiungere una sottosezione in §4 e una riga nel registro aggiornamenti.

---

## 6. Sicurezza e dati

- L’accesso all’area `/superadmin/*` è protetto da **ruolo** lato applicazione (`ProtectedRoute` / `RoleLayout`).
- I dati dei tenant e delle subscription passano da **Supabase** con le policy **RLS** configurate sul progetto: solo gli utenti autorizzati (es. superadmin) devono poter leggere/scrivere le tabelle sensibili.
- Ogni **tenant** isola i dati operativi delle singole pizzerie (`tenant_id` sulle entità applicative).

---

## 7. Collegamenti utili interni al repo

| Documento | Contenuto |
|-----------|-----------|
| `DEPLOY_COMANDI.md` | Deploy frontend (Firebase) e push backend (Koyeb) |
| `DEPLOY.md` | Procedura deploy dettagliata |
| `ARCHITETTURA_E_STATO.md` | Roadmap vs implementazione (admin tenant, operativo, gap) |
| Migrazioni SQL in `supabase/migrations/` | Schema, RLS, `utenti_ruoli` |

---

## 8. Registro aggiornamenti

Compila una riga per ogni modifica significativa all’area Super Admin.

| Data | Versione / commit | Cosa è cambiato |
|------|-------------------|-----------------|
| 2026-03-22 | — | Prima stesura guida: Riepilogo, Clienti, Piani, Abbonamenti, Impostazioni; note su limiti e sicurezza. |
| 2026-03-22 | — | Collegamento a `ARCHITETTURA_E_STATO.md` per allineamento roadmap / codice. |
| 2026-03-22 | — | Piani: gestione contenuti in Super Admin (localStorage); TRIAL 7 giorni; niente Free permanente. |

---

*Ultima revisione documento: 2026-03-22*
