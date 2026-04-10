# Linee guida — Area Admin (tenant / pizzeria)

Documento **vivo**: aggiornalo quando modifichi funzionalità visibili all’admin del locale, rotte `/admin/*`, servizi `adminService`, impostazioni tenant o menu pubblico.

---

## 1. Ruolo dell’Admin

L’**Admin** gestisce **un solo tenant** (la propria pizzeria): menu, impostazioni, report, dipendenti, ruoli e (se abilitato in build) i **gate sui moduli** in base al piano/servizi concordati con la piattaforma. **Dominio pubblico e go-live** del sito ordini sono gestiti dalla **console Super Admin** (non dall’Admin cliente).

**URL tipici:** dopo login, area `/admin/menu/...` (home), `/admin/settings/...`, `/admin/manuale`, `/admin/report` (se piano).

---

## 2. Cosa aggiornare quando sviluppi

| Ambito | Cosa mantenere allineato |
|--------|---------------------------|
| **Nuova pagina o voce menu** | `src/layouts/AdminLayout.jsx` (nav), `src/router/AppRouter.jsx` (route). `Dashboard.jsx` reindirizza solo (nessuna griglia card). |
| **Impostazioni tenant** | `getTenantSettings` / `updateTenantSettings` in `adminService.js`; colonne su `tenants` in Supabase + migrazioni. |
| **Menu pubblico / tema** | `parametri_operativi`, `LayoutSection`, `publicService.js`, test su dominio non-SaaS se applicabile. |
| **Servizi / moduli visibili** | Il Super Admin può impostare `parametri_operativi.servizi_abilitati` e `servizi_personalizzati` sul tenant; con `VITE_ENFORCE_SERVIZI_PLAN=true` l’app filtra card e rotte operative (`useTenantServizi`, `operativeNav`, layout). Documentare in **GUIDA_SUPERADMIN.md**. |
| **Testi in-app per lo staff** | `src/content/manualeUtente.md` + struttura navigazione `src/content/manualeRoadmap.js` (pagina **Admin → Manuale**, `/admin/manuale`). |
| **Privacy / termini lato locale** | **Impostazioni → Dati pizzeria** (nome, titolare/referente, email, indirizzo); `src/config/legalEntity.js` + `useLegalEntity`. |

---

## 3. Pubblicazione dominio (solo Super Admin)

Configurazione **dominio pubblico**, stato go-live, guida deploy e checklist DNS/Firebase: **`/superadmin/pubblicazione-sito`**. Vedi **`docs/GUIDA_SUPERADMIN.md`**.

---

## 4. Manuale operativo in app

Il testo della voce **Manuale** (`/admin/manuale`; redirect da `/admin/guida`) è **`src/content/manualeUtente.md`**, con roadmap macro/micro in **`src/content/manualeRoadmap.js`** e pagina **`src/features/admin/pages/ManualeUtentePage.jsx`**. In cima a quel markdown c’è una nota per gli sviluppatori (deploy e link alle altre guide).

---

## 5. Collegamenti utili nel repo

| File | Contenuto |
|------|-----------|
| `DEPLOY_COMANDI.md` | Build + Firebase, push backend |
| `docs/GUIDA_SUPERADMIN.md` | Console piattaforma, piani, servizi tenant |
| `docs/ARCHITETTURA_E_STATO.md` | Roadmap vs codice |
| `sql/schema_completo_pizzamanager.sql` + `sql/sql_upgrade.sql` | Schema tenant, viste, RPC (baseline + patch) |

---

## 6. Registro aggiornamenti (Admin)

| Data | Cosa è cambiato |
|------|-----------------|
| 2026-03-22 | Prima stesura: checklist sviluppo, Pubblicazione. |
| 2026-03-23 | Pubblicazione: wizard dominio + note RPC. |
| 2026-04-03 | Nota gate servizi / `parametri_operativi`; manuale tenant (`manualeUtente.md`, `/admin/manuale`) e allineamento Super Admin. |

---

*Ultima revisione: 2026-04-03*
