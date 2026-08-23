# PizzaManager — descrizione del sistema

## Cos'è

PizzaManager è un **gestionale SaaS multi-tenant per pizzerie**: un unico sistema che serve più locali indipendenti (ognuno isolato dagli altri), coprendo l'intero flusso operativo di una pizzeria — dall'ordine (in cassa, dal sito, da telefono) fino alla consegna o al ritiro, passando per cucina, banconi e reparti di preparazione. Non è un'app di food-delivery per il pubblico: è lo strumento di lavoro quotidiano del gestore e del suo staff, più un portale separato per il cliente finale (menù online, ordini, fidelity) e uno per chi gestisce l'intera piattaforma su più locali (Super Admin).

## I tre livelli dell'applicazione

- **Area pubblica / cliente** — vetrina del menù, checkout online, area personale con storico ordini e fidelity card, pensata mobile-first.
- **Area operativa** — le schermate che lo staff usa in negozio: Cassa (vendita, planning, turni), Cucina, Bancone, Pizzaioli, Delivery/Pony (consegne), ciascuna con la propria vista in tempo reale sugli stessi ordini.
- **Area Super Admin** — gestione di tutti i locali della piattaforma (tenant), configurazione piani/servizi per tenant, strumenti di supporto e diagnostica, checklist di sviluppo e di collaudo pre-lancio.

## Stack tecnologico

**Frontend**
- **React 18** con **Vite** come build tool/dev server (hot reload, build ottimizzata a chunk)
- **React Router** per il routing (in attesa di migrazione a una versione più recente)
- CSS scritto a mano (nessun framework UI pesante), con temi per tenant (colori/logo personalizzabili) via CSS custom properties
- **Leaflet** e **Google Maps JavaScript API** per mappe (area di consegna, geolocalizzazione indirizzi, mappa live posizione fattorini)
- Progressive Web App per l'app dedicata al rider (manifest, installabile su telefono)

**Backend / dati**
- **Supabase** come backend primario: Postgres gestito, autenticazione, **Row Level Security** per l'isolamento dati tra tenant (ogni query è vincolata al tenant dell'utente autenticato a livello di database, non solo di applicazione), **Realtime** (subscription Postgres via WebSocket per aggiornare cassa/cucina/bancone/delivery istantaneamente quando un ordine cambia), **Storage** per foto/prove di consegna e loghi, **Edge Functions** (Deno) per logica server-side aggiuntiva
- Business logic critica scritta come **funzioni PL/pgSQL** (RPC) — non semplici query dirette dal client: creazione ordini, transizioni di stato validate, gestione turni cassa con riconciliazione, assegnazione automatica dei rider per prossimità geografica, tutto eseguito e verificato lato database con **SECURITY DEFINER** e controlli di autorizzazione basati sui ruoli
- **NestJS** (TypeScript) come backend applicativo in affiancamento, con proprio deploy e pipeline di test/lint separata, per alcune scritture operative

**Pagamenti**
- Integrazione **Stripe** e **SumUp** per pagamenti online, checkout ospitato, link di pagamento condivisibili (WhatsApp/SMS), webhook per conferma asincrona dei pagamenti

**Infrastruttura e deploy**
- Hosting frontend su **Firebase Hosting**
- **GitHub Actions** per CI (lint, test, build) su ogni push, con job separati per frontend e backend Nest
- Migrazioni database tracciate come file SQL versionati, applicate in modo incrementale e mai cancellate dopo l'uso (storico completo delle modifiche allo schema)

**Testing**
- **Vitest** per i test unitari del frontend
- **node:test** (runner nativo di Node.js) per una seconda suite di test mirati
- **Jest** per i test del backend NestJS

**Funzionalità distintive**
- **Multi-reparto in tempo reale**: un ordine creato in cassa appare istantaneamente su Cucina, Bancone, Pizzaioli e Delivery, con conteggio automatico della capacità forno (pizze per fascia oraria) e aree di preparazione (ingredienti "fuori linea": congelati, fritti, dolci, bibite) colorate e condivise tra reparti
- **Consegne**: area di consegna disegnata su mappa (poligono geografico), calcolo automatico se un indirizzo è coperto, assegnazione e tracciamento fattorini, mappa live con posizione GPS reale dei pony aggiornata periodicamente
- **Turni cassa**: apertura/chiusura turno per punto vendita con fondo cassa dichiarato, riconciliazione automatica dello scostamento, storico consultabile, ordini collegati al turno che li ha generati
- **Macchina a stati ordine validata lato server**: le transizioni di stato di un ordine (in attesa → in preparazione → pronto → consegnato, oppure annullato) sono verificate dal database secondo regole esplicite, non lasciate al solo client, con log di audit di ogni cambiamento
- **Funziona offline in cassa**: coda locale che accumula gli ordini creati durante un'interruzione di rete e li sincronizza automaticamente al ritorno della connessione
- **Multi-tenant reale**: più pizzerie sullo stesso sistema, dati completamente isolati a livello di database, piani e servizi attivabili per singolo locale dal Super Admin

## In una frase

Un gestionale multi-reparto in tempo reale per pizzerie, costruito su React/Vite e Supabase (Postgres + RLS + Realtime), con pagamenti Stripe/SumUp, mappe per le consegne e un'architettura multi-tenant isolata a livello di database.
