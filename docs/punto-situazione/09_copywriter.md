# Copywriter — punto situazione PizzaManager

**Data:** 2026-08-04  
**Agente:** Copywriter UI (`@agents/copywriter.md`)  
**Commit di riferimento:** `41caf48` (gate Demo live, cucina ripulita, login/SA)  
**Mercato primario:** Italia (B2B ristorazione + vetrina cliente finale)

---

## 1. Tone of voice per superficie

### 1.1 Vetrina / cliente finale (`/negozio`, `/preview`, login cliente)

| Attributo | Linea guida |
|-----------|-------------|
| Registro | Caldo, chiaro, da pizzeria; niente gergo SaaS (`tenant`, `RPC`, `RLS`) |
| Brand | Nome del **locale** in evidenza; “PizzaManager” solo dove è piattaforma |
| Azioni | Imperativo breve: «Ordina», «Aggiungi», «Conferma», «Accedi» |
| Errori | Causale umana + cosa fare («Riprova» / «Contatta il locale»), non stack trace |
| Empty | «Nessun prodotto in questa categoria» (es.) — mai placeholder tecnici |

Stato: anteprima post-hardening dipende da branding RPC; copy vetrina non deve promettere pagamenti **live** se il tenant è ancora in Stripe test.

### 1.2 Admin tenant (gestore locale)

| Attributo | Linea guida |
|-----------|-------------|
| Registro | Professionale operativo: listino, dipendenti, orari, parametri |
| Terminologia | «locale / pizzeria», «listino», «cassa», «reparto» — non «tenant» in UI |
| Manuale | Voce attiva, passi brevi; allineato a `manualeUtente.md` |
| Toast / errori | Cosa non è andato + rimedio; niente nomi file SQL |

### 1.3 Super Admin — gate «Demo live» (`SuperadminGatePage`)

Testi attuali (IT, post-41caf48) — tono **privacy + dimostrazione commerciale**:

| Elemento | Copy |
|----------|------|
| Kicker | Accesso riservato |
| Titolo | Dove vuoi andare? |
| Lede | Resta loggato come Super Admin. La demo apre la Cassa del locale: usa la sidebar e «4 schermate» per mostrare i reparti reali, senza altri accessi. |
| Card 1 label | Demo live / Avvio demo… |
| Card 1 desc | Entra in Cassa con dati reali. Naviga dalla barra laterale: Cassa, Pizzaioli, Cucina, Bancone, Delivery e «4 schermate». |
| Card 2 | Solo vetrina — Apre solo il menù online (senza ciclo guidato). |
| Card 3 | Amministrazione — Console piattaforma, clienti e Sala QA |
| Errori | Nessun tenant disponibile… / Avvio demo non riuscito. |

**Principi rispettati:** niente jargon interno; spiega il percorso demo senza “iframe”, “override”, “UUID”. «Sala QA» resta termine prodotto SA (accettabile in console piattaforma).

### 1.4 Operativo — Cucina (testi ripuliti)

In `Cucina.jsx` (commit 41caf48) riduzione copy superfluo / rumore UI:

| Contesto | Messaggio residuo (funzionale) |
|----------|--------------------------------|
| Nessuna riga | Nessuna riga prodotto. |
| Coda vuota | Nessuna lavorazione in coda. |
| Fasce | Nessuna fascia oraria disponibile. |
| Fascia senza ordini | Nessun ordine in questa fascia. |
| a11y | `aria-label` su fasce, preparazioni, forno |

Direzione: **solo stato operativo**, niente istruzioni lunghe o note da debug in vista cucina (tablet/forno).

### 1.5 Cassa (nome / indirizzo)

Il fix UX su titolo lista ordini (nome grande + indirizzo sotto per delivery) è **comportamento**, non microcopy marketing. Evitare label ambigue tipo «Cliente» vs «Destinatario» incoerenti tra lista e checkout: allineare a «Cliente» / «Indirizzo di consegna» dove già usati in form checkout.

---

## 2. Debito copy residuo

| Priorità | Area | Problema | Azione suggerita |
|----------|------|----------|------------------|
| Alta | `QA_CHECKLIST_SMOKE.md` | Nessuna sezione Demo live / gate SA aggiornata | Aggiungere voci in IT allineate al gate |
| Media | Errori tecnici in toast admin/SA | Possibile leak di messaggi PostgREST/Postgres | Mappa errori → frasi utente |
| Media | «tenant» / «UUID» in messaggi SA avanzati | Compare in errori demo se env manca | Già soft: «cliente attivo»; verificare altri alert |
| Media | Roadmap Magazzino/Costi (etichette non cliccabili) | Tooltip «in roadmap» — ok; verificare coerenza tono | Tenere neutro, non “coming soon” anglofono |
| Bassa | Empty state Bancone/Delivery | Verificare parità con Cucina (frasi corte) | Passata copywriter su stringhe residue |
| Bassa | Email Auth / reset password | Template Supabase | Allineare brand PizzaManager + dominio reale Francy quando live |
| Bassa | Contatti / piani landing | Checkbox moduli — copy legale-adjacent | Solo informativo; no claim fiscali non verificati |

Non inventare feature in copy: Stripe **live**, dominio Francy, HIBP restano fuori dai claim “già attivo” finché non verificati.

---

## 3. Principi copy PizzaManager (checklist redazione)

1. **Italiano curato**, professionale ma umano; frasi brevi; voce attiva.
2. **Tre registri:** marketing (landing), prodotto (funzioni verificabili), supporto (calmo, risolutivo).
3. **Terminologia stabile:** ordine, listino, locale/pizzeria, cassa, vetrina, reparto, Super Admin, Sala QA (solo SA).
4. **Niente jargon da codebase** verso gestore o cliente finale.
5. **Niente iperboli** non dimostrabili («il migliore», «a prova di bomba»).
6. **Errori:** problema + prossima azione; niente stack o nomi migration.
7. **Demo live:** promettere “dati reali del locale” e navigazione reparti — non “pen-test” o “bypass RLS”.
8. **Accessibilità:** label bottoni e `aria-label` coerenti col testo visibile.
9. Prima di merge su pagine nuove rivolte a cliente / admin / SA: passata `@agents/copywriter.md`.

---

## 4. Glossario rapido (IT)

| Evitare in UI utente | Preferire |
|----------------------|-----------|
| tenant | locale / cliente (SA) / pizzeria |
| RPC / RLS / PostgREST | (omettere) / «salvataggio sul server» se serve |
| support_tenant | Sala QA / supporto live (solo SA) |
| _demo_giro | Demo live |
| payload / UUID | «codice cliente» solo se davvero necessario in SA |

---

## 5. Verdetto Copywriter (per il supervisore)

- Gate SA **Demo live** e ripulitura **Cucina** allineati ai principi (tono professionale, no slang).
- Debito residuo **non bloccante** per `41caf48`: checklist smoke da aggiornare, mappa errori tecnici, parità empty state altri reparti.
- Nessuna riscrittura massiva richiesta prima dell’approvazione di sprint; sì backlog copy mirato.

---

*Documento prodotto dall’agente Copywriter — 2026-08-04*
