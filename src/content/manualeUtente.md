<!--
  Manuale titolare / staff (area Admin tenant). Allineare i titoli ## / ### / #### con `src/content/manualeRoadmap.js`.
  Pagina in app: Admin → Manuale (`/admin/manuale`).
-->

> **Nota per chi modifica il repo:** la roadmap in colonna sinistra e la mappa concettuale sono in **`src/content/manualeRoadmap.js`**. Dopo le modifiche: build e deploy del frontend (`npm run deploy` o `npm run deploy:hosting`). Altre guide: **`docs/GUIDA_SUPERADMIN.md`**, **`docs/GUIDA_ADMIN.md`**; consultabili anche da **Super Admin → Documentazione** (`/superadmin/guide`).

## Introduzione

PizzaManager riunisce **menu**, **ordini**, **personale** e **impostazioni** del locale in un’unica console web. Questo manuale è organizzato in **macro-sezioni** (grande tema) e **micro-argomenti** (singoli argomenti): usa la **roadmap** a sinistra o la **mappa** qui sotto per saltare al punto che ti serve.

---

## Area amministratore

Accesso con account **admin** del locale: di solito atterri sul **Menu** (listino). Dalla **barra in alto** apri le altre aree (Manuale, Report se previsto, Menu, **Magazzino**, **Contabilità**, Dipendenti, Ruoli se previsto, Impostazioni). **Magazzino** e **Contabilità** sono moduli attivi: ordini fornitori e DDT da un lato; fatture, pagamenti, food cost, spese e incassi dall’altro (dati salvati nel browser per tenant fino a eventuale integrazione con il database).

### Manuale in app

Il link **Manuale** in alto apre questa pagina: testo aggiornato con la versione dell’app. A sinistra trovi la **roadmap** (macro e micro) per orientarti e andare dritto al paragrafo.

### Report vendite

Con il modulo incluso nel piano, **Report** mostra totali ordini, fatturato e prodotti più venduti nel periodo. **Non** è la lista ordini in tempo reale (quella è in **Cassa** e nelle altre aree operative).

### Menu e listino

Da **Menu** compare la **sidebar** dell’area admin: categorie, formati, cottura, pizze, ingredienti, impasti, bibite, dolci, fritti, allergeni.

### Magazzino e contabilità

**Magazzino** (`/admin/magazzino`): panoramica, **ordini fornitori** e registro **DDT** in entrata. **Contabilità** (`/admin/contabilita`): **fatture** (collegabili ai DDT), **pagamenti fatture**, **food cost**, spese di **gestione locale** e **personale**, **gestione incassi**. Le due aree hanno sidebar dedicata come Menu e Impostazioni.

### Dipendenti

Elenco degli **account collegati** al locale: **ruolo base** e se la persona può accedere. I permessi sulle **aree operative** (cassa, cucina, ecc.) si regolano in **Ruoli**.

### Ruoli e permessi operativi

Definisci **chi usa cassa, cucina, pizzaiolo, delivery**, ecc. I ruoli “di reparto” puntano soprattutto alla propria area; per **più reparti** sulla stessa persona usa il ruolo **operatore** e le spunte in **Ruoli**.

#### Nota sui piani e sui moduli

Se il piano non include alcuni moduli, alcune voci possono mancare: contatta il **Super Admin** della piattaforma.

### Impostazioni

**Dati pizzeria**, logo e colori, **orari**, **parametri operativi** (cassa, ritiri, ecc.).

**Dominio pubblico e go-live** (DNS, Firebase, stato pubblicazione) sono gestiti dal **team piattaforma** in **Super Admin → Pubblicazione dominio**, non dall’area admin del singolo locale.

---

## Area operativa

Gli operatori entrano nelle **aree operative** (cassa, cucina, bancone, ecc.) secondo ruolo e permessi. Da lì gestiscono ordini e flussi operativi **senza** le impostazioni amministrative del titolare.

---

## Sito pubblico e contatti

Sul **dominio principale** del servizio trovi **landing**, **piani** (descrizione moduli) e **Contatti** per prova o informazioni.

---

## Aggiornare il manuale

Il testo in app è in **`src/content/manualeUtente.md`** e la struttura della roadmap in **`src/content/manualeRoadmap.js`**. Dopo una modifica: build e deploy del frontend.

Documentazione piattaforma: **`docs/GUIDA_SUPERADMIN.md`**, **`docs/GUIDA_ADMIN.md`**, **Super Admin → Documentazione**.

---

## Cronologia contenuti

- **2026-04-03** — Rinominato in **Manuale**; mappa concettuale e roadmap macro/micro; allineamento a barra admin attuale.
- **2026-03-22** — Prima versione integrata in Admin.
