# Guida utente — Area Super Admin (PizzaManager)

Documento **vivo**: aggiornalo quando aggiungi o modifichi funzionalità nella console piattaforma. In fondo c’è una sezione **Registro aggiornamenti** da compilare a ogni release rilevante.

---

## 1. Cos’è il Super Admin

Il **Super Admin** gestisce l’intera piattaforma SaaS: **tenant (pizzerie)**, **listini e piani commerciali** (catalogo servizi + bundle), **deploy e domini** dei siti cliente, **abbonamenti** (subscription) e documentazione interna.

È un profilo distinto dall’**Admin di pizzeria** (tenant), che vede solo i dati del proprio locale.

**URL tipici (ambiente produzione):**

- Sito pubblico / login: `https://pizzamanager.it` (o dominio `app.*` configurato)
- Area Super Admin: `https://pizzamanager.it/superadmin/dashboard` (dopo login; ingresso spesso da `/superadmin/ingresso`)

---

## 2. Accesso

1. Apri la pagina di **login** del progetto SaaS.
2. Accedi con un utente il cui ruolo in database è **superadmin** (tabella `public.utenti_ruoli`, campo `ruolo` = `superadmin`, collegato al tuo `user_id` Supabase).
3. Dopo l’accesso, l’app può mostrare prima **Ingresso** (`/superadmin/ingresso`) e poi la **Panoramica** (`/superadmin/dashboard`).

Se l’accesso funziona ma non vedi l’area Super Admin, verifica in Supabase che il profilo sia presente e attivo in `utenti_ruoli`.

---

## 3. Struttura menu (console enterprise)

La barra superiore è organizzata in **cluster** (etichette in maiuscoletto) per ridurre ambiguità tra voci simili.

| Cluster | Voci | Percorso | Ruolo |
|---------|------|----------|--------|
| **Accesso** | Ingresso | `/superadmin/ingresso` | Schermata iniziale / passaggio alla console |
| **Commercio** | Panoramica | `/superadmin/dashboard` | KPI piattaforma e schede rapide |
| | Clienti | `/superadmin/tenants` | Tenant: anagrafica, contratto, **piano/servizi** |
| | Piani e listini | `/superadmin/piani` | Bundle commerciali (servizi inclusi, canone = somma listino) |
| | Catalogo servizi | `/superadmin/servizi` | Moduli vendibili, prezzi e schede (`/superadmin/servizi/:id`) |
| | Abbonamenti | `/superadmin/licenses` | Subscription, stato, rinnovi |
| **Go-live** | Deploy siti | `/superadmin/deploy-clienti` | Checklist go-live / domini |
| | Pubblicazione dominio | `/superadmin/pubblicazione-sito` | Dominio pubblico tenant, stato, guida DNS/Firebase |
| **Piattaforma** | Documentazione | `/superadmin/guide` | Hub guide (markdown da `docs/` e build) |
| | Roadmap | `/superadmin/sviluppo` | Avanzamento sviluppo / export CSV allineati al catalogo |
| | Anteprima sito | `/superadmin/home-pizzeria` | Anteprima home pubblica (stesso componente marketing) |
| | Sistema | `/superadmin/settings` | Impostazioni globali (UI in evoluzione) |

**Route aggiuntive (non sempre in barra):** `/superadmin/test-reparti` (strumenti interni), documenti sotto `/superadmin/guide/:slug` (es. `superadmin`, `admin`, `deploy`).

**Admin di pizzeria (tenant):** menu, impostazioni, report, dipendenti, ruoli — vedi **`docs/GUIDA_ADMIN.md`**. **Pubblicazione dominio** è in **`/superadmin/pubblicazione-sito`** (questa console).

---

## 4. Pagine in dettaglio

### 4.1 Panoramica (`/superadmin/dashboard`)

- Schede di navigazione verso le altre sezioni (etichette allineate alla console).
- **KPI:** clienti totali/attivi, abbonamenti, ordini totali (dipende da tabella configurata nel client).
- **Clienti per piano:** distribuzione per enum `FREE` / `PRO` / `ENTERPRISE` (e varianti UI come TRIAL).
- **Abbonamenti per stato** e **ultimi clienti** con link a **Clienti**.

---

### 4.2 Ingresso (`/superadmin/ingresso`)

Schermata di benvenuto / passaggio verso la Panoramica o le aree operative, secondo il flusso configurato nell’app.

---

### 4.3 Clienti — Tenant (`/superadmin/tenants`)

**Elenco:** tutti i tenant non eliminati (`deleted_at` nullo). Colonne riassuntive incluso **Contratto** (etichetta piano) e **Listino** (nome piano commerciale o “Servizi su misura” se personalizzato).

**Modale creazione / modifica:**

- **Anagrafica:** nome, slug, **livello contratto (subscription)** — valori UI tipici: **TRIAL** (prova, bundle operativo come Pro), **FREE** (bundle Base), **PRO**, **ENTERPRISE**. Su database/subscription gli enum sono `FREE`, `PRO`, `ENTERPRISE` (mapping da `superadminService`).
- **Prova valida fino al** e flag **Cliente attivo**.
- **Piano commerciale e servizi**
  - **Modello da listino:** applica le inclusioni di un piano definito in **Piani e listini** (stessi dati in localStorage).
  - **Personalizza servizi:** abilita le checkbox sul **catalogo servizi**; in salvataggio si scrive su `tenants.parametri_operativi` con `servizi_personalizzati: true` e `servizi_abilitati: [id, …]`. Con **`VITE_ENFORCE_SERVIZI_PLAN=true`** (e senza bypass), l’app tenant usa questo elenco per i gate sui moduli.
  - **Allinea livello contratto:** suggerisce l’enum subscription in base ai servizi selezionati.
  - **Canone stimato:** somma dei prezzi listino (riferimento commerciale; non sostituisce fatturazione).
- **Dati fiscali e contatti:** P.IVA, email, PEC, codice SDI.
- **Abbonamento:** addebito automatico mensile, data attivazione, sconto % sul canone.

**Persistenza:** tabella `tenants` (vista `public.tenants` / `core.tenants` a seconda del progetto). Il campo **`parametri_operativi`** (JSONB) deve essere esposto in select/update affinché i servizi personalizzati funzionino.

---

### 4.4 Piani e listini (`/superadmin/piani`)

- I **prezzi** dei piani sono la **somma** dei `prezzoMensile` dei servizi inclusi (unica fonte, come in catalogo).
- Modale piano: nome, descrizione, validità giorni, **abilitato**, inclusioni servizi a checkbox.
- Persistenza in **localStorage** (`pizzamanager_superadmin_plans_v2`); catalogo servizi in `pizzamanager_superadmin_services_v2`.
- La **landing** pubblica può leggere gli stessi piani nello stesso browser; **non mostra importi** in pagina marketing (solo moduli e testi). I contatti da sito usano **`/contatti`** con scelta piano / moduli.

---

### 4.5 Catalogo servizi (`/superadmin/servizi`)

- Elenco moduli con prezzo, categoria, avanzamento (stima sviluppo).
- Scheda per servizio: `/superadmin/servizi/:servizioId` (note implementative, link utili).
- CSV / ripristino default da registro codice (`serviziAppRegistro`).

---

### 4.6 Roadmap / Sviluppo (`/superadmin/sviluppo`)

- Vista avanzamento allineata al catalogo (percentuali, export dove previsto).

---

### 4.7 Deploy siti clienti (`/superadmin/deploy-clienti`)

- Checklist e riferimenti per go-live, domini, Firebase Hosting; allineato a `DEPLOY_COMANDI.md`. Il form **dominio / stato pubblicazione** e la **guida deploy** modale sono in **Pubblicazione dominio** (sotto).

---

### 4.7b Pubblicazione dominio (`/superadmin/pubblicazione-sito`)

- Scelta tenant, salvataggio **dominio pubblico**, **stato go-live**, URL sito vetrina cliente; sezioni DNS / Firebase e checklist. Non è disponibile nell’area Admin del cliente.

---

### 4.7c Supabase Authentication — URL configuration (reset password clienti)

Quando un tenant ha il **menu / vetrina sul proprio dominio** (non solo su `pizzamanager.it`), i clienti possono usare **Password dimenticata** e **Reimposta password** sul **sito della pizzeria**. L’app invia a Supabase un `redirectTo` uguale a **`https://<origine-del-sito-cliente>/reimposta-password`** (l’origine è quella del browser al momento della richiesta).

**Operazione da fare in Supabase (Dashboard del progetto):**

1. Apri **Authentication** → **URL Configuration**.
2. In **Redirect URLs** aggiungi, **per ogni dominio** su cui è pubblicata la vetrina (e per eventuali sottodomini usati in produzione), una riga del tipo:
   - `https://www.tuapizzeria.it/reimposta-password`
   - `https://ordini.tuapizzeria.it/reimposta-password`
3. Se il registrar/hosting lo consente, puoi usare un **wildcard** Supabase (es. `https://*.tuapizzeria.it/reimposta-password`) per coprire più host sotto lo stesso dominio.
4. La **Site URL** può restare il dominio principale della piattaforma (es. `https://pizzamanager.it`); conta soprattutto che l’URL di redirect del link email sia **in elenco** (altrimenti il recupero password dal sito cliente fallisce o viene deviato in modo errato).

**Nota:** il **reset password da UI è solo per account cliente** sul sito pizzeria; lo **staff** non ha flusso equivalente nell’app (gestione password fuori da questa procedura).

**Riferimento codice:** `src/features/public/services/clienteAuthService.js` (`requestClientePasswordReset`), route `/password-dimenticata` e `/reimposta-password` (solo su dominio non-SaaS).

---

### 4.8 Abbonamenti (`/superadmin/licenses`)

- Tabella subscription: cliente, piano enum, stato, `rinnovo_il`.
- Se mancano righe, il client può proporre upsert di allineamento (vedi `superadminService`).

---

### 4.9 Anteprima sito (`/superadmin/home-pizzeria`)

- Anteprima della home / marketing pubblica (stesso stack delle pagine pubbliche).

---

### 4.10 Documentazione (`/superadmin/guide`)

- **Hub** con link ai documenti markdown inclusi nel build: Super Admin, Admin tenant, Manuale utente (tenant), Architettura, CSV ingredienti, Comandi deploy (`DEPLOY_COMANDI.md`).

---

### 4.11 Sistema (`/superadmin/settings`)

- Parametri globali (placeholder / bozza finché non collegati a backend).

---

## 5. Sito pubblico, landing e contatti

- **Landing (`/`):** sezione piani senza **prezzi** in evidenza; elenco moduli per piano; link “Richiedi informazioni” con `?piano=<id>` verso Contatti.
- **Contatti (`/contatti`):** modulo con scelta **piano da listino** o **Personalizzato** (checkbox moduli); il testo riepilogativo viene incluso nel corpo dell’email (`mailto`).

---

## 6. Operazioni che il Super Admin **non** fa (oggi) nell’UI

- Dashboard **MRR / fatturazione SaaS** dettagliata
- **Monitor infrastruttura** unificato
- **Fatture PDF** e storico pagamenti integrato
- Persistenza **centralizzata su server** dei piani/listini (oggi listino + piani in **localStorage** del browser che configura la console)

---

## 7. Sicurezza e dati

- Accesso `/superadmin/*` protetto da ruolo (`ProtectedRoute` / layout dedicato).
- Dati su **Supabase** con **RLS**; tenant isolati con `tenant_id`.

---

## 8. Collegamenti utili interni al repo

| Documento | Contenuto |
|-----------|-----------|
| `DEPLOY_COMANDI.md` | Deploy frontend (Firebase) e note backend |
| `docs/GUIDA_ADMIN.md` | Admin tenant (menu, impostazioni, report; senza pubblicazione dominio) |
| `docs/ARCHITETTURA_E_STATO.md` | Route vs roadmap |
| `sql/PM_UNIFIED_ALL.sql` / `supabase/migrations/` | Schema, `parametri_operativi`, viste tenant |

---

## 9. Nota sviluppo (file e variabili rilevanti)

- **`plansStorage.js`:** caricamento/salvataggio piani, default, normalizzazione; usato anche dalla landing.
- **`useTenantServizi.js` / `tenantServiziPolicy.js`:** risoluzione servizi per tenant; flag `servizi_personalizzati` su `parametri_operativi`.
- **`VITE_ENFORCE_SERVIZI_PLAN`**, **`VITE_DISABLE_SERVIZI_GATE`:** vedi `.env.example`.
- **`SuperAdminLayout` + `superadmin-enterprise.css`:** stile console (barra slate, cluster navigazione).
- **Go-live dominio cliente:** dopo DNS/hosting, verificare in **Supabase → Authentication → Redirect URLs** la presenza di `https://<dominio-tenant>/reimposta-password` (vedi §4.7c).

---

## 10. Registro aggiornamenti

| Data | Versione / commit | Cosa è cambiato |
|------|-------------------|-----------------|
| 2026-03-22 | — | Prima stesura guida classica (Riepilogo, Clienti, Piani, Abbonamenti, Impostazioni). |
| 2026-04-03 | — | Riscrittura: menu enterprise a cluster; Clienti con servizi personalizzati e `parametri_operativi`; Piani/catalogo/localStorage; Catalogo servizi, Sviluppo, Deploy, Guide hub, Anteprima sito; landing senza prezzi e modulo Contatti con piano; variabili enforcement servizi; registro TRIAL 14 gg allineato alle etichette UI. |
| 2026-04-03 | — | §4.7c: Supabase URL Configuration e Redirect URLs per reset password clienti su dominio vetrina; nota sviluppo §9. |

---

*Ultima revisione documento: 2026-04-03*
