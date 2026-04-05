# Architettura ruoli — visione prodotto vs stato implementazione

Documento di **allineamento** tra la roadmap (visione SaaS) e ciò che è effettivamente in codice oggi. Aggiornarlo quando introduci nuove route, KPI o integrazioni backend.

---

## 1. Admin di pizzeria (tenant): menu ideale vs route reali

**Implementazione attuale (barra superiore `AdminLayout`):**

| Voce menu | Route | Cosa apre davvero |
|-----------|--------|-------------------|
| *(home)* | `/admin` → `/admin/menu/...` | Atterraggio su listino (categorie); **nessuna** pagina Riepilogo KPI dedicata |
| Manuale | `/admin/manuale` (redirect da `/admin/guida`) | `src/content/manualeUtente.md` + roadmap `manualeRoadmap.js` |
| Report | `/admin/report` | Vendite aggregate — **non** è la lista ordini live (area operativa / cassa) |
| Menu | `/admin/menu/...` | Sidebar: categorie, formati, cottura, pizze, ingredienti, impasti, bibite, dolci, fritti, allergeni |
| Magazzino | `/admin/magazzino/...` | Hub, ordini fornitori, DDT; dati `localStorage` per tenant (`useTenantLocalJson`) |
| Contabilità | `/admin/contabilita/...` | Fatture, pagamenti, food cost, spese locale/personale, incassi; stesso modello dati locale |
| Dipendenti | `/admin/dipendenti` | Utenti del tenant |
| Ruoli | `/admin/ruoli` | Permessi aree operative; ruoli di reparto con area dedicata |
| Impostazioni | `/admin/settings/...` | Dati pizzeria, layout, orari, parametri |

**Vecchia route tenant** `/admin/pubblicazione` → redirect a **`/admin/manuale`** (nessun form pubblicazione in area cliente).

**Pubblicazione dominio / go-live:** non è nell’area Admin cliente; **Super Admin → Pubblicazione dominio** (`/superadmin/pubblicazione-sito`). Layout Super Admin **senza** colonna sinistra aggiuntiva sotto la nav principale.

**Visibilità moduli (opzionale):** con `VITE_ENFORCE_SERVIZI_PLAN=true`, card e voci operative possono essere filtrate in base al piano tenant e a `parametri_operativi.servizi_abilitati` / `servizi_personalizzati` (impostati dal Super Admin). Vedi `useTenantServizi.js`.

**Gap noti (roadmap):**

- **Lista ordini admin** dedicata: non presente; riepilogo in Report e operativo.
- **KPI avanzati** come schermata dedicata: non nel front.
- **Alert magazzino** automatici: non come modulo unico; sovrapposizione con **Prodotti esauriti** in cassa.

---

## 2. Super Admin (piattaforma)

| Capacità roadmap | Stato |
|------------------|--------|
| Dashboard tenant, piani, abbonamenti, catalogo servizi, deploy | Presente (`/superadmin/*`) |
| Console UI “enterprise” (cluster menu, slate) | Presente (`SuperAdminLayout`, `superadmin-enterprise.css`) |
| Piani/listino in localStorage + stessa fonte landing | Presente (`plansStorage.js`); landing **senza prezzi** |
| Tenant: servizi personalizzati in `parametri_operativi` | Presente (modale Clienti) |
| MRR, billing, fatture PDF | Non come schermate dedicate |
| Persistenza piani su server | Non ancora; listino ancora browser-local |
| Monitor (log, performance API, DB) | Non nel router |

Dettaglio: **`docs/GUIDA_SUPERADMIN.md`**.

---

## 3. Area operativa

| Voce | Route | Note |
|------|--------|------|
| Riepilogo, Cassa, Cucina, Bancone, Pizzaioli, Delivery, Prodotti esauriti | Esistenti | Permessi + eventuale gate servizi |
| **Turni** | `/operative/turni` | Permesso cassa / flusso turno |

---

## 4. Sito pubblico

| Elemento | Stato |
|----------|--------|
| Landing, Contatti, login | Route pubbliche |
| Piani su landing | Da listino (localStorage / default), **senza importi** in UI |
| Contatti | Scelta piano listino o moduli personalizzati nel modulo |

---

## 5. Sicurezza e backend

| Argomento | Stato |
|-----------|--------|
| Controllo ruoli lato SPA | `ProtectedRoute`, `RoleLayout`, Supabase Auth |
| Multi-tenant | `tenant_id`, RLS |
| API Node/Nest (turni, ecc.) | Opzionale accanto al client Supabase |

---

## 6. Come aggiornare questo file

1. Modifica le tabelle quando cambiano route o comportamento.
2. Chiudi i “gap” spostando le righe e aggiornando il registro.

### Registro

| Data | Modifica |
|------|----------|
| 2026-03-22 | Prima versione: admin, Super Admin, operativo, sicurezza. |
| 2026-03-22 | Route dipendenti, turni; note KPI. |
| 2026-04-03 | Super Admin ampliato (catalogo, deploy, enterprise UI, piani/landing/contatti); gate servizi; tabella sito pubblico; admin Guida e Pubblicazione in tabella menu. |
| 2026-04-03 | Admin: route e sidebar Magazzino e Contabilità (dati locali tenant); tabella menu aggiornata. |

---

*Ultima revisione: 2026-04-03*
