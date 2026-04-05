# Manuale tenant (puntatore)

Il contenuto mostrato in **Admin → Manuale** (`/admin/manuale`) è il file:

**`src/content/manualeUtente.md`**

La roadmap macro/micro in colonna sinistra e la mappa concettuale sono definite in **`src/content/manualeRoadmap.js`** (allineare i titoli al markdown).

Per aggiornare il manuale online: modifica questi file, esegui build e deploy del frontend (`npm run deploy` o la pipeline abituale).

- Panoramica piattaforma (Super Admin): **`docs/GUIDA_SUPERADMIN.md`**
- Linee guida per chi sviluppa l’area Admin tenant: **`docs/GUIDA_ADMIN.md`**
- Le stesse guide (e altre) sono consultabili in console da **Super Admin → Documentazione** (`/superadmin/guide`).

---

*Ultima revisione: 2026-04-03*
