# Linee guida — Area Admin (tenant / pizzeria)

Documento **vivo**: aggiornalo quando modifichi funzionalità visibili all’admin del locale, rotte `/admin/*`, servizi `adminService`, impostazioni tenant o menu pubblico.

---

## 1. Ruolo dell’Admin

L’**Admin** gestisce **un solo tenant** (la propria pizzeria): menu, impostazioni, report, dipendenti, ruoli e (in evoluzione) **pubblicazione del sito** cliente collegato alla stessa app.

**URL tipici:** dopo login, area `/admin/dashboard`, `/admin/menu/...`, `/admin/settings/...`, `/admin/pubblicazione`.

---

## 2. Cosa aggiornare quando sviluppi

| Ambito | Cosa mantenere allineato |
|--------|---------------------------|
| **Nuova pagina o voce menu** | `src/layouts/AdminLayout.jsx` (nav), `src/router/AppRouter.jsx` (route), eventuale card in `Dashboard.jsx` (`ADMIN_NAV`). |
| **Impostazioni tenant** | `getTenantSettings` / `updateTenantSettings` in `adminService.js`; colonne su `tenants` in Supabase + migrazioni in `supabase/migrations/`. |
| **Menu pubblico / tema** | `parametri_operativi`, `LayoutSection`, `publicService.js`, test su dominio non-SaaS se applicabile. |
| **Testi in-app** | `src/content/guidaUtente.md` (pagina Guida utente). |
| **Privacy / termini lato locale** | Dati in **Impostazioni → Dati pizzeria** (nome, titolare/referente, email, indirizzo); logica in `src/config/legalEntity.js` + `useLegalEntity`. |

---

## 3. Pubblicazione sito (`/admin/pubblicazione`)

- Pagina **centro di coordinamento** per collegare il sito del cliente a PizzaManager e per le future automazioni di deploy.
- Oggi: checklist e riferimenti; **deploy effettivo** ancora da pipeline / procedura repo (`DEPLOY_COMANDI.md`).
- Quando aggiungi funzioni (DNS, build, log): aggiorna questa guida, la sezione in **GUIDA_SUPERADMIN.md** (registro) e il testo in `PubblicazioneSitoPage.jsx`.

---

## 4. Collegamenti utili nel repo

| File | Contenuto |
|------|-----------|
| `DEPLOY_COMANDI.md` | Build + Firebase, push backend |
| `docs/GUIDA_SUPERADMIN.md` | Console piattaforma (tenant globali) |
| `docs/ARCHITETTURA_E_STATO.md` | Roadmap vs codice |
| `supabase/migrations/*.sql` | Schema tenant, vista `public.tenants` |

---

## 5. Registro aggiornamenti (Admin)

| Data | Cosa è cambiato |
|------|-----------------|
| 2026-03-22 | Prima stesura guida: checklist sviluppo, tabella allineamento, nota pagina Pubblicazione. |

---

*Aggiorna la tabella del §5 e la data in fondo a ogni release rilevante dell’area Admin.*
