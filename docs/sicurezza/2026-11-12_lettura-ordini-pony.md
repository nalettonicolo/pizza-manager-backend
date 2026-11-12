# Revisione sicurezza: letture ordini del pony (rider)

Data: 2026-11-12 · Solo documento, nessuna modifica al codice o al database.
Decisione presa: **il pony vede solo i propri ordini e quelli da assegnare.**

## Sintesi

Oggi la regola «il pony vede solo i propri ordini e quelli liberi» esiste **solo nell'interfaccia** (`filterOrdiniPerPony`). Il database lascia leggere al pony **tutti gli ordini del locale, con tutte le colonne**. Chi apre gli strumenti del browser (o chiama `/rest/v1/Ordine`) vede nomi, telefoni, indirizzi, coordinate e dati di pagamento di tutti i clienti, anche di quelli presi da altri pony, già consegnati o ritirati in negozio.

## Cosa ho letto

- `src/features/operative/delivery/pages/DeliveryDashboard.jsx`
- `src/features/operative/delivery/pages/RiderPwaPage.jsx`
- `src/features/operative/pony/pages/Pony.jsx`
- `src/features/operative/pony/pages/PonyDelivery.jsx`
- `src/features/operative/delivery/utils/ponyOrderVisibility.js`
- `src/features/admin/services/adminService.js` (`getOrders`, `riderEnsureMe`, `deliveryUpdateStatoConsegna`, `markDeliveryConsegnatoWithProof`, `cassaConsegneOdierne`, `cassaElencaPony`)
- `sql/modules/124_cassa_consegne_odierne_e_assegna_rider.sql`, `126_pony_presa_in_carico_e_conteggio.sql`, `127_pony_nome_sessione_e_assegna.sql` (sostituisce la versione di 124/126 di `cassa_consegne_odierne`), `138_fix_ordine_view_scrittura_solo_staff.sql`, `139_fix_audit_sicurezza_batch.sql`, `142_fix_delivery_mark_consegnato_bypass.sql`
- `pm_core_tenant_access` in `sql/schema_completo_pizzamanager.sql` (righe 11153-11214)
- Vista `public."Ordine"` in `sql/modules/45_ordini_web_accettazione_cassa.sql` (riga 65)

Non verificato: il database sul server di casa (`pizzamanager_copia`) **non contiene** la tabella `core.ordini` né le sue policy (le query su `information_schema` e `pg_policies` tornano vuote), quindi non ho numeri reali. Anche lo stato di produzione dei moduli 147 e 148 non è verificabile: nel repository ci sono solo i moduli fino al 146.

## Come legge oggi il pony

1. `DeliveryDashboard.jsx:179` chiama `getOrders(tenantId, { stato: "PRONTO", todayOnly: true, limit: 80 })`.
2. `adminService.js:133-137` fa `supabase.from("Ordine").select("*").eq("tenantId", …)`: **tutte le colonne** della vista.
3. La vista `Ordine` (modulo 45) è `security_invoker`, quindi vale la policy `pm_core_ordini_select` su `core.ordini` (modulo 138, righe 114-117): `USING (pm_core_tenant_access(tenant_id))`.
4. `pm_core_tenant_access` restituisce `true` per: superadmin, **qualsiasi riga attiva in `utenti_ruoli` del tenant** (quindi anche un account con ruolo `pony`), **qualsiasi cliente del tenant (`clienti`)**, **qualsiasi rider attivo del tenant (`core.rider`)**. Non guarda mai il tipo di ruolo né la proprietà dell'ordine.
5. Il filtro `filterOrdiniPerPony` gira nel browser, dopo che i dati sono già arrivati.

## Problemi trovati (dal più grave)

1. **Lettura di tutti gli ordini del locale da parte del pony** (`pm_core_ordini_select` + `pm_core_tenant_access`). Il filtro è solo lato client: va aggirato con una chiamata REST diretta.
2. **Il filtro lato client si rompe senza `riderId`.** In `ponyOrderVisibility.js:22-23`, se `riderId` è nullo (succede quando `ponyNome` è vuoto: `DeliveryDashboard.jsx:150-153` non chiama `riderEnsureMe`, oppure la chiamata fallisce) la funzione restituisce `true` anche per gli ordini già presi da altri pony. Il pony li vede in lista.
3. **Colonne in eccesso.** Con `select("*")` arrivano anche `pagamento_dettaglio`, `online_payment` (contiene gli identificativi Stripe), `web_cliente_user_id`, `telefono_ritiro` di ordini altrui, `note`, `turno_operatori_id`, `percorso_attivo_id`, `cucina_prep_stato`, ecc.
4. **Il ramo `clienti` di `pm_core_tenant_access` (e della vista `Ordine`) non risulta chiuso nel repository.** Il file di stato del progetto dice che i moduli 145-148 hanno chiuso la falla «un cliente web leggeva tutti gli ordini del locale», ma il modulo 138 (l'ultimo che tocca la policy di lettura, in questo repository) lascia ancora passare qualsiasi cliente del tenant, e i moduli 147-148 non sono nel repository. **Da verificare in produzione** con un account cliente vero. Se è ancora aperta, è più grave del punto 1 (i clienti non sono personale).
5. **`cassa_consegne_odierne` (modulo 127, che sostituisce 124 e 126).** Il controllo accessi accetta qualsiasi riga attiva in `utenti_ruoli` del tenant: un pony può chiamarla e ottenere di tutte le consegne di oggi `nome_cliente`, `indirizzo_consegna`, `totale`, `tipo_pagamento`, `orario_ritiro`, rider e nome pony. È la stessa esposizione del punto 1 per un'altra via. Stesso controllo largo in `cassa_elenca_pony` (nomi dei pony: rischio basso).
6. **Scritture fuori dalla regola «solo i propri» (non letture, ma collegate):**
   - `delivery_update_stato_consegna` controlla il conflitto tra pony solo per `IN_VIAGGIO`/`ASSEGNATO`. Un pony può rimettere in `RICHIESTA` o `PROBLEMA` l'ordine di un altro.
   - `delivery_mark_consegnato` (e `…_with_proof`, non letta) non controlla che l'ordine sia suo né che sia di tipo delivery.
   - `pm_core_staff_tenant_access` (modulo 138) è vera per **qualsiasi** riga attiva in `utenti_ruoli`, quindi un account con ruolo `pony` può anche fare UPDATE diretto sulla vista `Ordine` (totale, indirizzo, stato…).
7. **`Pony.jsx`** legge tutti gli ordini `PRONTO` di oggi **di ogni tipo** (anche ritiro in negozio) con `select("*")`, mostra `note` e usa `updateOrderStato` generico. Non ho verificato se la rotta è ancora raggiungibile: se è un residuo, meglio eliminarla.
8. **`PonyDelivery.jsx`** non legge dati. Controlla solo che esista `?token=` ma **non lo valida**: oggi è innocuo (mostra «Caricamento ordine…»), ma non va completato appoggiandosi a quel controllo.
9. **`RiderPwaPage.jsx`** non legge ordini; passa il nome alla dashboard. Il nome è libero e solo di sessione: l'identità vera è `core.rider.auth_user_id`, ed è su quella che va fondato il filtro.

## Dati personali esposti oggi al pony

| Dato | Colonna / RPC | Serve al pony? |
|---|---|---|
| Nome cliente | `nome_cliente` | Sì, solo per i suoi ordini/da assegnare |
| Telefono | `telefono_ritiro` | Dipende (vedi domande) |
| Indirizzo e coordinate | `indirizzo_consegna`, `consegna_lat`, `consegna_lng` | Sì, solo per i suoi ordini/da assegnare |
| Note ordine | `note` | Sì ma solo se riguardano la consegna |
| Importo e metodo di pagamento | `totale`, `tipo_pagamento` | Sì (incasso contanti/POS) |
| Dettaglio pagamento | `pagamento_dettaglio` | **No** |
| Dati pagamento online (id Stripe) | `online_payment` | **No** |
| Identità account cliente web | `web_cliente_user_id` | **No** |
| Dati interni (turno, percorso, cucina, accettazione cassa, punto vendita) | `turno_operatori_id`, `turno_rider_id`, `percorso_attivo_id`, `cucina_prep_stato`, `richiede_accettazione_cassa`, `punto_vendita_id` | **No** |
| Ordini di ritiro/sala e ordini altrui | tutte | **No** |

## Colonne minime per il pony

Per ogni ordine di consegna di oggi, **non annullato, non consegnato**, con `rider_id IS NULL` oppure `rider_id` = rider dell'utente:

`id`, `numero`, `stato_consegna`, `orario_ritiro`, `nome_cliente`, `indirizzo_consegna`, `consegna_lat`, `consegna_lng`, `tipo_pagamento`, `totale`, `note` (da valutare), e un booleano calcolato `mio` al posto di `rider_id`.
`telefono_ritiro`: solo se Nicolò conferma (domanda 1).

Il pony chiude la consegna anche con prove (foto/firma): quella parte (`delivery_mark_consegnato_with_proof`, `ConsegnaProofDialog`, stampa ricevuta di cortesia che legge le righe d'ordine) **non l'ho esaminata**.

## Proposta di correzione (non applicata, non provata)

Ordine consigliato, così l'app non si rompe:

1. **Nuova RPC di lettura** `pony_ordini_visibili(p_tenant_id uuid)`, `SECURITY DEFINER`, che restituisce solo le colonne minime e applica nel database il filtro (delivery, oggi, non chiusi, `rider_id` nullo o proprio, ricavato da `core.rider.auth_user_id = auth.uid()`). Il front-end (`DeliveryDashboard` in `riderView`) la usa al posto di `getOrders`.
2. **Poi** restringere `pm_core_ordini_select`: oggi `true` per «qualsiasi riga di `utenti_ruoli`». La nuova regola dovrebbe escludere i soli account pony/delivery (ruolo operativo senza `accesso_cassa`/admin) e limitare i `clienti` ai propri ordini (`web_cliente_user_id = auth.uid()`). Va fatto con una **nuova funzione** (per esempio `pm_core_ordini_lettura_completa`), **non** modificando `pm_core_tenant_access`, che è usata dalle policy di molte altre tabelle `core`.
3. Allineare allo stesso modo la vista `Ordine`.
4. Restringere `cassa_consegne_odierne` e `cassa_elenca_pony` a cassa/admin/superadmin (come già fa `cassa_assegna_consegna_pony`).
5. In `delivery_update_stato_consegna` e `delivery_mark_consegnato`: rifiutare se l'ordine ha un altro `rider_id`; in `pm_core_staff_tenant_access` escludere il ruolo pony dalle scritture dirette.
6. Correggere `ponyOrderVisibility.js`: senza `riderId` non mostrare gli ordini già presi.

**Come provarlo (a modifiche fatte):** servono due account pony veri sullo stesso locale di prova (non un account admin: un admin vede tutto e non prova niente) e un account cliente web.
- Con il pony A: prendere in carico un ordine; con il pony B: la lista non deve mostrarlo, e una chiamata diretta `GET /rest/v1/Ordine?select=*` deve restituire zero righe (o errore) per ordini non suoi.
- Con il pony A: `rpc/cassa_consegne_odierne` deve rispondere `non_autorizzato`.
- Con il cliente web: `GET /rest/v1/Ordine?select=*` deve restituire solo i suoi ordini.
- Con la cassa: tutto invariato (lista, assegnazione, conteggio consegne).
- Prima del rilascio, controllare che il ritiro bancone → pony e gli aggiornamenti in tempo reale (`useOperativeOrdersLiveRefresh`, non letto: se usa Realtime sulla tabella, il pony riceve le righe complete) continuino a funzionare.

**Rischi:** restringere la policy prima di cambiare l'app svuota la schermata pony; la policy tocca anche cassa/cucina/bancone, che leggono con lo stesso `getOrders`; il percorso `nestOperativeOrdini` (lettura tramite backend Nest, `operativeApi.js`) non l'ho letto e potrebbe avere un suo filtro o nessuno.

## Domande per Nicolò

1. Il pony deve vedere il **telefono** del cliente (per chiamarlo al citofono)? Se sì, solo sui suoi ordini.
2. Un pony può vedere **anche gli ordini degli altri pony che sono ancora «da assegnare» a qualcuno**, o solo quelli senza assegnatario? (Ho assunto: senza assegnatario.)
3. Tutti i pony hanno una riga in `utenti_ruoli` con ruolo `pony`, o alcuni sono solo in `core.rider`? Cambia come si scrive la nuova policy.
4. Puoi confermare in produzione (con un account cliente vero) se la falla dei clienti che leggono tutti gli ordini è davvero chiusa? Nel repository non lo vedo.

## Issue proposte

- **Lettura ordini pony solo propri e da assegnare** — creare la RPC `pony_ordini_visibili` con le colonne minime, usarla in `DeliveryDashboard` (vista rider) e poi restringere `pm_core_ordini_select`, la vista `Ordine` e `cassa_consegne_odierne`/`cassa_elenca_pony`; perché oggi il filtro è solo nel browser.
- **Verifica policy lettura ordini per i clienti web** — controllare in produzione che un cliente veda solo i propri ordini e aggiungere nel repository i moduli 147-148 mancanti.
- **Scritture pony limitate ai propri ordini** — controllo sul `rider_id` in `delivery_update_stato_consegna` e `delivery_mark_consegnato`, e ruolo pony escluso da `pm_core_staff_tenant_access`.

## Prossimi passi

1. Rispondere alle domande 1-4 (soprattutto la 4, da verificare subito in produzione).
2. Assegnare al reparto Sviluppo la prima issue (RPC + app), poi la restrizione della policy, da provare con due account pony veri.
3. Decidere se eliminare `Pony.jsx` e `PonyDelivery.jsx` se non più usati.

---
Nota operativa: lavoro sul ramo `ufficio/2026-11-12-7ff4d20d98`, non su `sicurezza/lettura-ordini-pony`, e non posso eseguire comandi: la creazione del ramo richiesto e la pull request in bozza vanno fatte da te o dal reparto Pubblicazione.
