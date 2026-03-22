<!--
  Guida per il titolare / staff della pizzeria (area Admin e riferimenti operativi).
  Aggiornare questo file quando si aggiungono funzioni visibili all’utente.
  La stessa pagina è disponibile in Admin → Guida.
-->

## Introduzione

PizzaManager ti permette di gestire **menu**, **ordini**, **personale** e **impostazioni** del locale da un’unica console web. Questa guida riassume cosa puoi fare oggi e dove trovarlo.

---

## Area Admin (accesso titolare / amministratore)

Dopo l’accesso con un account **admin** del tuo locale, dalla barra in alto puoi aprire:

| Sezione | Descrizione breve |
|--------|-------------------|
| **Riepilogo** | KPI giornalieri (ordini, fatturato, utenti attivi). |
| **Report** | Totali vendite, best seller, filtri per periodo. |
| **Menu** | Categorie, formati, cottura, pizze, impasti, bibite, dolci, fritti, allergeni. |
| **Magazzino** | Ingredienti, quantità e costi (riferimento per listini e margini). |
| **Costi** | Vista pizze e prezzi. |
| **Dipendenti** | Account collegati al locale. |
| **Ruoli** | Chi può entrare in quali **aree operative** (cassa, cucina, pizzaiolo, ecc.). |
| **Impostazioni** | Dati pizzeria, logo/colori, orari, parametri operativi (cassa, ritiri, ecc.). |

### Ruoli e permessi

Ogni utente ha un **ruolo** (es. cassa, pizzaiolo). Di default vede soprattutto l’area del proprio ruolo.  
È possibile **abilitare aree aggiuntive** dalla pagina **Ruoli** (spunte “sempre per ruolo” + aree extra).

---

## Area operativa (staff in sala / cucina)

Gli operatori accedono alle **aree operative** (cassa, bancone, cucina, pizzaioli, delivery, ecc.) in base al ruolo e ai permessi impostati in **Admin → Ruoli**.

---

## Dove aggiornare questa guida (per chi sviluppa)

Il testo mostrato in app è il file **`src/content/guidaUtente.md`** nel progetto.  
Dopo una modifica, eseguire build e deploy del frontend come di consueto.

---

## Ultimo aggiornamento contenuti

- **2026-03-22** — Prima versione pubblicata in app (guida integrata in Admin, permessi aree, miglioramenti sessione).
