-- Modulo 89 — Contenuti reali per le landing page dei moduli
--
-- Origine: handoff sessione Claude mobile (mod 61). Sostituisce i placeholder '[da scrivere]'
-- creati nel modulo 80 con testi reali. Solo UPDATE su landing_pages (nessun riferimento a
-- tenant/profiles/schema, non serve riscrittura). La landing 'vs-trancio' NON è toccata qui:
-- resta in sospeso (vedi modulo 88). Restano pubblicata = false: la messa online è una
-- decisione separata, da fare a mente fredda dopo revisione — vedi anche il promemoria sulle
-- linee guida di stile nel modulo 90.

update public.landing_pages set contenuto = $$
## Il menu digitale che il cliente vede, non quello che deve immaginare

Chi ordina online decide con gli occhi. Una vetrina lenta, confusa o senza foto perde ordini prima ancora che il cliente arrivi al carrello. Il modulo Ordini Online di PizzaManager è pensato per essere la prima cosa che il cliente vede di te — e per farti fare bella figura anche quando non sei tu a rispondere al telefono.

**Cosa include**

- Vetrina pubblica personalizzabile, con foto, categorie e varianti (impasto, formato, ingredienti extra)
- Ordini sincronizzati in tempo reale con cassa e comanda: nessun doppio inserimento, nessun ordine perso su un foglio
- Notifiche push dirette sul telefono del cliente, anche senza scaricare un'app: basta aggiungere la pagina alla schermata Home
- Gestione di orari di apertura, pause e chiusure straordinarie senza dover disattivare tutto manualmente

**Perché conviene**

Ogni ordine che entra da solo in cassa è un ordine che il tuo staff non deve trascrivere a mano dal telefono mentre la sala è piena. Meno errori, meno tempo perso, più ordini che davvero arrivano in cucina come li ha scritti il cliente.
$$
where slug = 'modulo-ordini-online';

update public.landing_pages set contenuto = $$
## La cassa pensata per il ritmo di una pizzeria, non per un ufficio

Il venerdì sera non c'è tempo per un software che si blocca, che chiede troppi passaggi, o che va capito da zero ogni volta che cambia il turno. La Cassa di PizzaManager è costruita per essere usata sotto pressione, da chi in sala ci lavora davvero.

**Cosa include**

- Incasso rapido da tablet o PC, senza hardware proprietario obbligatorio
- Chiusura cassa automatica con riepilogo di incassi, metodi di pagamento e scontrini emessi
- Gestione di sconti, coperti e note d'ordine senza dover uscire dalla schermata principale
- Storico completo degli scontrini, consultabile in qualsiasi momento

**Perché conviene**

Meno tocchi sullo schermo significano meno tempo alla cassa e più tempo con i clienti. E a fine serata, il quadro dei conti è già pronto: niente calcoli a mano, niente sorprese in chiusura.
$$
where slug = 'modulo-cassa';

update public.landing_pages set contenuto = $$
## Zero bigliettini, zero equivoci in cucina

Quante volte un ordine è arrivato in cucina scritto male, o non è arrivato affatto? La Comanda digitale di PizzaManager collega sala, cassa e forno in un unico flusso: quello che viene ordinato è esattamente quello che il pizzaiolo vede sul suo schermo.

**Cosa include**

- Invio istantaneo degli ordini dalla cassa o dagli ordini online direttamente al punto cottura
- Suddivisione automatica per stazione (forno, farciture, bevande) se il locale è organizzato su più postazioni
- Segnalazione visiva dei tempi di attesa, per non perdere il controllo nelle serate piene
- Storico delle comande per verificare tempi medi di preparazione

**Perché conviene**

Meno passaggi a voce, meno fraintendimenti, più coordinamento tra sala e cucina — proprio nei momenti in cui coordinarsi è più difficile.
$$
where slug = 'modulo-comanda';

update public.landing_pages set contenuto = $$
## Consegne che arrivano in orario, non "quando capita"

Il delivery è il reparto dove un piccolo ritardo si trasforma subito in una recensione negativa. Il modulo Delivery di PizzaManager assegna i rider in automatico, tiene traccia di ogni consegna e tiene aggiornato il cliente senza che tu debba rispondere al telefono ogni cinque minuti.

**Cosa include**

- Assegnazione automatica del rider più adatto in base a carico di lavoro e posizione
- Calcolo dei tempi di consegna basato sul percorso reale, non su una stima fissa
- Notifiche push al cliente a ogni fase: ordine confermato, in preparazione, in consegna
- Vista d'insieme di tutte le consegne attive, per intervenire subito se qualcosa rallenta

**Perché conviene**

Un cliente che sa dove si trova il suo ordine chiama meno e si lamenta meno. E tu hai sotto controllo l'intera flotta rider senza dover tenere tutto a mente.
$$
where slug = 'modulo-delivery';

update public.landing_pages set contenuto = $$
## Sai sempre cosa hai in dispensa, non solo cosa pensi di avere

La farina finita a metà serata, la mozzarella ordinata due volte per errore: nella ristorazione il magazzino gestito a occhio costa caro. Il modulo Magazzino di PizzaManager tiene traccia di ogni ingrediente con un valore reale, non solo un numero a caso.

**Cosa include**

- Inventario valorizzato a costo medio ponderato: sai quanto vale davvero quello che hai in dispensa
- Scarico automatico degli ingredienti a ogni ordine, collegato alle ricette
- Avvisi quando una materia prima sta per esaurirsi
- Storico dei movimenti di magazzino, utile anche per capire dove si spreca di più

**Perché conviene**

Conoscere il costo reale di ogni pizza che esce dal forno è il primo passo per capire dove guadagni davvero e dove stai solo lavorando per coprire gli sprechi.
$$
where slug = 'modulo-magazzino';

update public.landing_pages set contenuto = $$
## Clienti che tornano, non solo clienti che ordinano una volta

Attirare un cliente nuovo costa sempre più che far tornare uno che ti conosce già. Il modulo Fidelity di PizzaManager trasforma ogni ordine in un motivo in più per farsi rivedere, senza bisogno di gestire tessere di carta o fogli Excel.

**Cosa include**

- Punti fedeltà assegnati automaticamente a ogni ordine, online o in cassa
- Premi e sconti configurabili in base alla soglia raggiunta dal cliente
- Storico degli ordini per cliente, utile per capire chi sono i tuoi habitué
- Comunicazione diretta con il cliente tramite le stesse notifiche usate per gli ordini

**Perché conviene**

Un programma fedeltà che funziona da solo, integrato con gli ordini che già ricevi, senza dover gestire una piattaforma a parte.
$$
where slug = 'modulo-fidelity';

update public.landing_pages set contenuto = $$
## Un quadro chiaro dei conti, senza aprire un foglio Excel a fine mese

Sapere quanto hai incassato è facile. Sapere quanto ti è rimasto in tasca dopo costi e sprechi, molto meno. Il modulo Contabilità di PizzaManager mette insieme incassi, costi di magazzino e spese fisse in un quadro leggibile, aggiornato da solo.

**Cosa include**

- Riepiloghi periodici di incassi e costi, incrociati con i dati di cassa e magazzino
- Vista per periodo (giorno, settimana, mese) per individuare subito gli andamenti
- Base solida per il confronto con il tuo commercialista, senza dover ricostruire tutto a mano
- Storico consultabile in qualsiasi momento, senza fogli sparsi

**Perché conviene**

Meno tempo a rincorrere numeri sparsi tra cassa, magazzino e appunti, più chiarezza su dove sta andando davvero la tua pizzeria.
$$
where slug = 'modulo-contabilita';

update public.landing_pages set contenuto = $$
## Più locali, un solo cruscotto

Gestire una seconda pizzeria non dovrebbe voler dire raddoppiare i grattacapi. Il modulo Multi-sede di PizzaManager ti dà una vista unica su tutti i tuoi locali, mantenendo comunque autonomia operativa a ognuno.

**Cosa include**

- Cruscotto centralizzato con incassi e ordini di tutte le sedi
- Cataloghi e prezzi configurabili per singola sede, o replicabili su tutte in un passaggio
- Magazzino e fidelity gestiti sede per sede, senza mischiare i dati
- Confronto diretto tra le performance dei diversi locali

**Perché conviene**

Quando decidi di aprire una seconda sede, l'ultima cosa di cui hai bisogno è un secondo sistema da imparare da zero. Con PizzaManager, cresci senza moltiplicare la complessità.
$$
where slug = 'modulo-multisede';
