# Architettura ruoli — visione prodotto vs stato implementazione

Documento di **allineamento** tra la roadmap (visione SaaS) e ciò che è effettivamente in codice oggi. Aggiornarlo quando introduci nuove route, KPI o integrazioni backend.

---

## 1. Admin di pizzeria (tenant): menu ideale vs route reali

La documentazione di prodotto elencava voci tipo: Dashboard, Ordini, Menu, Magazzino, Costi, Dipendenti, Turni, Report.

**Implementazione attuale (barra superiore `AdminLayout`):**

| Voce menu | Route | Cosa apre davvero |
|-----------|--------|-------------------|
| Riepilogo | `/admin/dashboard` | KPI giornalieri (ordini oggi, fatturato, utenti attivi) |
| Report | `/admin/report` | Vendite aggregate: totale ordini, fatturato, prodotto più venduto — **non** è la lista ordini live (quella è in area operativa / cassa) |
| Menu | `/admin/menu/...` | Sotto-menu: categorie, formati, pizze, bibite, ecc. |
| Magazzino | `/admin/menu/ingredienti` | Ingredienti con quantità e costi unitari (CSV, soglie: dipende da dati/API) |
| Costi | `/admin/menu/pizze` | Listini e composizione pizze (ricavi lato menu; margini analitici avanzati in roadmap) |
| Dipendenti | `/admin/dipendenti` | `UserManager`: utenti del tenant, ruolo, attivo/disattivo |
| Ruoli | `/admin/ruoli` | Configurazione permessi sulle aree operative |
| Impostazioni | `/admin/settings/...` | Dati pizzeria, layout, orari, parametri |

**Gap noti (roadmap):**

- **Lista ordini admin** dedicata: non presente; il riepilogo ordini è nel **Report** e nell’**area operativa**.
- **KPI avanzati** (ticket medio, pizze vendute, orari di punta come schermata dedicata): **non** nel front; testo esplicativo sul riepilogo admin.
- **Alert magazzino automatici** (job + notifiche soglia): non come modulo dedicato; possibile sovrapposizione con **Prodotti esauriti** in cassa (`/operative/cassa/prodotti-esauriti`).

---

## 2. Super Admin (piattaforma)

| Capacità roadmap | Stato |
|------------------|--------|
| Dashboard tenant, piani, abbonamenti | Presente (`/superadmin/*`) |
| MRR, billing, fatture PDF | Non come schermate dedicate |
| Monitor (log errori, performance API, utilizzo DB) | Non presente nel router |

Dettaglio funzionale: `docs/GUIDA_SUPERADMIN.md`.

---

## 3. Area operativa

| Voce | Route | Note |
|------|--------|------|
| Riepilogo, Cassa, Cucina, Bancone, Pizzaioli, Delivery, Prodotti esauriti | Esistenti | Filtrate da `permessiAree` |
| **Turni** | `/operative/turni` | UI con `TurnoControl` (API `/api/turni/...`). Visibile con permesso **cassa** (stesso flusso operativo del turno) |

**Gap precedente:** mancava voce “Turni” nella sidebar — **risolto** con route dedicata.

---

## 4. Sicurezza e backend

| Argomento | Stato |
|-----------|--------|
| Controllo ruoli lato SPA | `ProtectedRoute`, `RoleLayout`, contesto Supabase |
| Multi-tenant | `tenant_id`, RLS su Supabase (vedi migrazioni) |
| Middleware HTTP unico (Express) per ogni tenant | Non è il modello principale: autorità su **RLS + client**; eventuale API Nest/Node separata per turni/integrazioni |

---

## 5. Come aggiornare questo file

1. Aggiungi o modifica righe nelle tabelle quando cambiano route o significato delle pagine.
2. Per ogni release che chiude un “gap”, sposta la riga dalla sezione *Gap* a *Implementazione* e indica la versione o la data nel registro sotto.

### Registro

| Data | Modifica |
|------|----------|
| 2026-03-22 | Prima versione: mappatura admin (Magazzino/Costi/Dipendenti), Super Admin, operativo Turni, sicurezza. |
| 2026-03-22 | Nav admin e route `/admin/dipendenti`, `/operative/turni`; dashboard admin: nota KPI avanzati. |
