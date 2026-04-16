# QA Smoke Operativa - PizzaManager

Checklist rapida per regressioni sui flussi critici multi-stato e multi-reparto.

## Precondizioni

- Tenant test valido con dati base (categorie/prodotti/ingredienti).
- Almeno 2 utenti: uno `cassa`, uno `delivery/pony` (o equivalente).
- Planning e turni cassa abilitati.

## 1) Cassa - checkout / modifica / annullo

- [ ] Creare ordine `negozio` con 2 righe prodotto.
- [ ] Verificare salvataggio `tipo_ordine`, totale e righe su DB.
- [ ] Modificare ordine (quantita + nota + tipo pagamento) e verificare persistenza.
- [ ] Passare ordine da `delivery` a `negozio` e confermare coerenza UI reparti.
- [ ] Annullare ordine e verificare esclusione da planning/contabilita.

## 2) Cucina - prep -> pronto

- [ ] Aprire ordine in preparazione e segnare ingredienti prep.
- [ ] Portare ordine in `PRONTO`.
- [ ] Verificare presenza in Bancone e Delivery (solo se `tipo_ordine=delivery`).

## 3) Bancone - pronto -> consegnato

- [ ] Tappare almeno 3 chip ingredienti/bibite in Bancone.
- [ ] Refresh pagina e verificare persistenza pick.
- [ ] Cambiare set ordini (nuovo poll) e verificare pruning con messaggio reset.
- [ ] Segnare ordine come `CONSEGNATO` e verificare rimozione lista.

## 4) Delivery - FSM consegna

- [ ] Da Delivery impostare `ASSEGNATO`, poi `IN_VIAGGIO`.
- [ ] Eseguire `CONSEGNATO` e verificare transizione atomica (ordine + stato_consegna).
- [ ] Verificare assenza divergenza tra `stato` e `stato_consegna`.

## 5) Planning slot e overnight

- [ ] Validare slot `18:00-02:00`, `20:00-00:00`, `00:00-04:00`.
- [ ] Verificare ordinamento slot e conteggi pizze per fascia.

## 6) Turni cassa

- [ ] Aprire turno cassa su punto vendita.
- [ ] Creare ordine con turno attivo.
- [ ] Chiudere turno e verificare riconciliazione base.

## 7) Sicurezza tenant (smoke)

- [ ] Verificare che utente tenant A non veda/modifichi ordini tenant B.
- [ ] Verificare creazione ordine via RPC solo su tenant autorizzato.
- [ ] Verificare menu pubblico senza esposizione `tenant_id` in payload client.

## Evidenze minime da salvare

- Screenshot per ogni sezione.
- Eventuali errori console/network.
- Esito finale: `PASS` / `FAIL` con note.
