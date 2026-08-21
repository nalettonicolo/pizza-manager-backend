# Guida al file CSV ingredienti

Questa guida spiega come compilare il file CSV da usare per **caricare gli ingredienti** nel portale Pizzeria Manager (pulsante **CSV** → **Inserisci CSV**). Sono supportati **due formati**: con colonna allergeni unica (nomi separati da virgola) oppure **foglio con spunte** (una colonna per ogni allergene).

---

## 1. A cosa serve il file

Il CSV permette di inserire **molti ingredienti in una sola volta** invece di aggiungerli uno a uno dal form. È utile per:
- aprire un nuovo punto vendita con una lista già pronta;
- allineare più pizzerie alla stessa lista;
- aggiornare massivamente i dati dopo averli preparati in Excel/Google Fogli.

---

## 2. Elenco allergeni (lista ufficiale)

Gli allergeni riconosciuti dal sistema sono quelli previsti dalla normativa (Allegato II Reg. UE 1169/2011). Usare **esattamente** i nomi indicati sotto quando compili la colonna allergeni o le colonne a spunta.

| Nome da usare nel CSV | Descrizione / dove si trova |
|-----------------------|-----------------------------|
| **Glutine** | Cereali: frumento, segale, orzo, avena, farro, kamut, e derivati. Pasta, pane, pizza, birra. |
| **Crostacei** | Gamberi, gamberetti, scampi, granchi, aragoste, gamberi di fiume e derivati. |
| **Uova** | Uova di gallina e derivati (pasta all’uovo, maionese, creme, gelati). |
| **Pesce** | Pesce e derivati (surgelati, conserve, estratti, oli di pesce). Anche acciughe, tonno, capperi sotto sale. |
| **Soia** | Fagioli di soia, salsa di soia, tofu, miso, edamame, lecitina di soia. |
| **Latte** | Latte e derivati: formaggi, burro, panna, yogurt, gelati, besciamella. |
| **Frutta a guscio** | Mandorle, nocciole, noci, anacardi, pistacchi, noci di Macadamia, noci del Brasile, noci pecan. |
| **Sedano** | Sedano (gambo, foglie, semi, radice) e derivati. |
| **Senape** | Semi di senape, mostarda, salse e condimenti a base di senape. |
| **Sesamo** | Semi di sesamo, olio e pasta di sesamo (tahin), panature. |
| **Solfiti** | Anidride solforosa e solfiti in concentrazioni &gt; 10 mg/kg: vino, birra, aceto, conserve, frutta secca trattata. |
| **Lupini** | Semi di lupino e derivati (farina, prodotti da forno). |
| **Molluschi** | Mitili, vongole, cozze, ostriche, seppie, calamari, polpo, lumache di mare. |

Se un ingrediente contiene uno di questi allergeni, indicarlo nel file (nella colonna unica **allergeni** separati da virgola, oppure con **spunta** nella colonna corrispondente nel foglio a spunte). Nomi diversi da quelli in tabella vengono ignorati.

---

## 3. Formato del file

- **Estensione:** `.csv`
- **Separatore di colonna:** **punto e virgola** `;` (obbligatorio)
- **Separatore decimale:** **virgola** `,` oppure **punto** `.` (es. `0,50` o `0.50` per 50 centesimi)
- **Prezzi sempre con 2 decimali:** usare sempre due cifre dopo la virgola/punto (es. `0,80` e non `0,8`; `1,00` e non `1`).
- **Codifica:** **UTF-8** (per avere correttamente lettere accentate: à, è, ò, ecc.)
- **Intestazione:** la **prima riga** deve essere l’intestazione con i nomi delle colonne (vedi sotto). Non va ripetuta per ogni ingrediente.

---

## 4. Formato A – Colonna allergeni unica

### Colonne

| Colonna        | Obbligatoria | Descrizione | Esempio |
|----------------|--------------|-------------|---------|
| **nome_ingrediente** | Sì  | Nome dell’ingrediente (univoco per il tuo tenant). | `Mozzarella` |
| **costo_eur**       | Sì  | Prezzo unitario in euro (sempre 2 decimali, es. 0,80). | `0,80` o `0.80` |
| **abbondante**      | No  | Sovrapprezzo in euro per variante “abbondante”. Lasciare vuoto se non usato. | `0,25` |
| **senza**           | No  | Sconto in euro per variante “senza” (solitamente valore negativo). | `-0,80` |
| **poco**            | No  | Sconto in euro per variante “poco” (solitamente negativo). | `-0,15` |
| **va_in_cottura**   | No  | Se l’ingrediente va in cottura: `1` o `si`; altrimenti `0` o vuoto. | `1` oppure `0` |
| **prep_cucina**     | No  | Serve **solo** per ingredienti **senza categoria** che vanno comunque preparati (es. tagliati, scongelati): `1` o `si`; altrimenti `0` o vuoto. Se l’ingrediente ha già una **categoria** (vedi riga sotto), compare in automatico su Cucina/Bancone — non serve anche `prep_cucina`. Colonna opzionale: se manca, vale no. | `1` oppure `0` |
| **allergeni**       | No  | Nomi degli allergeni associati, separati da **virgola** `,` nella stessa cella. Usare solo i nomi della tabella §2. | `Latte` oppure `Latte,Glutine` |
| **categoria**       | No  | Tipo ingrediente per Cucina/Bancone/Pizzaiolo: `affettato` \| `fritto` \| `dolce` \| `bibita` \| `congelato` (sinonimi accettati: bibite, fritti, surgelato, …). Il **colore** non si imposta da CSV: segue sempre questa categoria (personalizzabile poi dal form ingrediente in Admin → Ingredienti). Vuoto = nessuna categoria specifica. | `affettato` |

- **Obbligatorie:** `nome_ingrediente` e `costo_eur`.
- **Opzionali:** le altre; si possono lasciare vuote rispettando l’ordine delle colonne.

### Intestazione (prima riga)

```text
nome_ingrediente;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;allergeni;categoria
```

(Senza colonna **prep_cucina** il file resta valido: usare `nome_ingrediente;costo_eur;abbondante;senza;poco;va_in_cottura;allergeni` come prima. `categoria` in coda è sempre opzionale; se assente, la categoria degli ingredienti esistenti non si tocca.)

---

## 5. Formato B – Foglio con celle a spunta (consigliato per il cliente)

Questo formato è **ideale da dare al cliente**: una riga per ingrediente e **una colonna per ogni allergene**, con celle da compilare con **spunta** (1, x, sì, ✓). Nessun testo da scrivere negli allergeni, solo “spunto” o “lascio vuoto”.

### Struttura della riga 1 (intestazione)

La **prima riga** del foglio deve contenere, in ordine e separati da **punto e virgola** `;`:

1. **nome_ingrediente**
2. **ordine** (se usi l’export dal portale; altrimenti vedi template)
3. **costo_eur**
4. **abbondante**
5. **senza**
6. **poco**
7. **va_in_cottura**
8. **prep_cucina** (opzionale ma consigliato: `1`/`0` o `si`/vuoto; preparazione in cucina)
9. Poi **tutte le colonne allergeni**, una per allergene, con il **nome esatto** come in tabella §2:

```text
nome_ingrediente;ordine;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;Glutine;Crostacei;Uova;Pesce;Soia;Latte;Frutta a guscio;Sedano;Senape;Sesamo;Solfiti;Lupini;Molluschi
```

File **senza** colonna `prep_cucina` (subito prima degli allergeni) sono ancora supportati: la settima colonna dopo `va_in_cottura` può essere direttamente **Glutine**.

Puoi copiare la riga qui sopra e incollarla nella prima riga del foglio Excel/Google Fogli. Nel pacchetto è disponibile anche un **file template** già pronto: `docs/template_ingredienti_formato_b.csv` (puoi aprirlo con Excel o Google Fogli e compilare le righe dati; dalla pagina Ingredienti → CSV puoi anche **Scarica template** per ottenere lo stesso file).

Dopo l'ultima colonna allergene puoi aggiungere, sempre opzionale, **categoria** (affettato | fritto | dolce | bibita | congelato) — vedi §11 per l'intestazione completa con questa colonna in coda. Non esiste più una colonna colore: il colore segue sempre la categoria.

### Come compilare le righe dati (da riga 2 in poi)

- **Colonne fino a va_in_cottura:** nome, ordine (se presente), costi con 2 decimali, va_in_cottura con `1` o `0`.
- **Colonna prep_cucina (dopo va_in_cottura, prima degli allergeni):** `1`, `si`, `x`, ecc. se serve preparazione in cucina; `0` o vuoto se no. Se ometti l’intera colonna (file legacy), gli allergeni iniziano subito dopo `va_in_cottura`.
- **Colonne allergeni:** per ogni allergene presente nell’ingrediente metti nella cella uno dei seguenti valori (tutti equivalenti a “sì”):
  - `1`
  - `x` o `X`
  - `sì` o `si`
  - `yes`
  - `s`
  - `✓` (simbolo di spunta)
  - Lasciare **vuoto** o `0` se l’ingrediente **non** contiene quell’allergene.

### Esempio foglio con spunte (anteprima)

| nome_ingrediente | ordine | costo_eur | abbondante | senza | poco | va_in_cottura | prep_cucina | Glutine | … |
|------------------|--------|-----------|------------|-------|------|---------------|-------------|---------|---|
| Pomodoro         | 0      | 0,40      | 0,20       | -0,40 | -0,15| 1             | 0           |         |   |
| Mozzarella       | 0      | 0,80      | 0,25       | -0,80 | -0,20| 0             | 0           |         | … Latte |
| Spinaci surg.    | 0      | 0,50      | …          | …     | …    | 0             | **1**       |         |   |

In CSV (prima riga + 2 dati) risulterà ad esempio:

```text
nome_ingrediente;ordine;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;Glutine;Crostacei;Uova;Pesce;Soia;Latte;Frutta a guscio;Sedano;Senape;Sesamo;Solfiti;Lupini;Molluschi
Pomodoro;0;0,40;0,20;-0,40;-0,15;1;0;;;;;;;;;;;;;;
Mozzarella;0;0,80;0,25;-0,80;-0,20;0;0;;;;;;1;;;;;;
```

### Vantaggi del formato a spunte

- **Semplice:** il cliente vede subito tutti gli allergeni e spunta solo quelli che servono.
- **Nomi corretti:** le intestazioni di colonna sono già i nomi ufficiali, niente errori di battitura.
- **Compatibile:** il portale accetta sia questo formato sia il Formato A (colonna allergeni unica).

---

## 6. Esempi di righe dati (Formato A)

**Ingrediente semplice (solo nome e costo):**

```text
Basilico;0,15;;;;;
```

**Ingrediente con varianti:**

```text
Mozzarella;0,80;0,25;-0,80;-0,20;;
```

**Ingrediente che va in cottura:**

```text
Pomodoro;0,40;0,20;-0,40;-0,15;1;
```

**Ingrediente con allergeni (un solo allergene):**

```text
Gorgonzola;0,55;0,30;-0,55;-0,20;;Latte
```

**Ingrediente con più allergeni (separati da virgola nella stessa cella):**

```text
Wurstel;0,40;0,25;-0,40;-0,15;;Glutine,Latte
```

**Ingrediente con categoria (colore assegnato in automatico; niente `prep_cucina`, la categoria basta da sola):**

```text
Patate surgelate;0,50;0,20;-0,50;-0,10;0;0;;congelato
```

**File completo di esempio (3 righe + intestazione, con categoria in coda):**

```text
nome_ingrediente;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;allergeni;categoria
Pomodoro;0,40;0,20;-0,40;-0,15;1;0;;
Mozzarella;0,80;0,25;-0,80;-0,20;0;0;Latte;
Patate surgelate;0,50;0,20;-0,50;-0,10;0;0;;congelato
```

---

## 7. Regole da rispettare

1. **Un ingrediente per riga:** una riga = un solo ingrediente.
2. **Nomi univoci:** non inserire due righe con lo stesso `nome_ingrediente` per lo stesso punto vendita (verrebbe accettato solo il primo o segnalato errore, a seconda della configurazione).
3. **Numeri:** per i costi usare solo numeri (e eventuale segno meno per senza/poco). Non usare il simbolo € nel file.
4. **Virgola o punto decimale:** in Italia spesso si usa la virgola (0,80). Se il programma che genera il CSV usa il punto (0.80), va bene ugualmente.
5. **Allergeni:** scrivere **esattamente** i nomi degli allergeni già presenti nel sistema. Nella **stessa cella** separare più allergeni con **virgola** (es. `Latte,Glutine`). Eventuali nomi sconosciuti vengono ignorati.
6. **Va in cottura:** nella colonna `va_in_cottura` usare `1` o `si`/`sì` per sì, `0` o vuoto per no.
7. **Prep. cucina:** nella colonna `prep_cucina` (se presente) stessi valori di `va_in_cottura` per sì/no. Usarla **solo** per ingredienti senza `categoria` che vanno comunque preparati (es. scongelati): se hai già impostato una categoria, l'ingrediente compare da solo su Cucina/Bancone.
8. **Categoria e colore:** la colonna `categoria` (se presente) assegna il tipo (affettato/fritto/dolce/bibita/congelato) e il **colore segue sempre in automatico** quella categoria — non esiste una colonna colore nel CSV. Per un colore diverso dal default, cambialo dal form ingrediente in Admin → Ingredienti dopo l'import.
9. **Righe vuote:** le righe completamente vuote vengono ignorate.

---

## 8. Come creare/salvare il file da Excel o Google Fogli

### Excel (Windows / Mac)

1. Compila le colonne come in tabella. Per il **Formato A:** A = nome_ingrediente, B = costo_eur, …, F = va_in_cottura, G = prep_cucina (opzionale), H = allergeni. Per il **Formato B (spunte):** prima riga con `prep_cucina` prima delle colonne allergeni (vedi §5); dalla riga 2 in poi metti 1/x/sì nelle celle degli allergeni.
2. **File** → **Salva con nome**.
3. Scegli **CSV UTF-8 (delimitato da virgola)** oppure **CSV (delimitato da punto e virgola)**.
4. Se Excel salva con **virgola** come separatore, apri il file con un editor di testo (Blocco note, Notepad++) e:
   - sostituisci tutte le virgole tra colonne con **punto e virgola** `;`;
   - oppure in Excel usa **Impostazioni regionali** con separatore elenco = `;` e poi salva di nuovo come CSV.
5. Controlla che la **prima riga** sia l’intestazione corretta: per Formato A includere `prep_cucina` prima di `allergeni` se la usi; per Formato B la riga con `prep_cucina` e tutti gli allergeni (vedi §5).

### Google Fogli

1. Compila il foglio con la prima riga = intestazione e le righe dati sotto.
2. **File** → **Scarica** → **Valori separati da virgola (.csv)**.
3. Apri il file scaricato con un editor di testo: Google spesso usa la virgola. Sostituisci le virgole **solo tra un campo e l’altro** con **punto e virgola** `;`, mantenendo virgole nei decimali (es. 0,80) se necessario.
4. Salva con codifica **UTF-8** e estensione **.csv**.

### Editor di testo (Blocco note, Notepad++, VS Code)

1. Scrivi la riga di intestazione.
2. Aggiungi una riga per ogni ingrediente, con campi separati da `;`.
3. Salva con nome tipo `ingredienti.csv`, codifica **UTF-8**.

---

## 9. Cosa succede quando carichi il file

1. Clic su **CSV** nella pagina Ingredienti.
2. Scegli **Inserisci CSV** e poi **Scegli file CSV**.
3. Seleziona il file `.csv`.
4. Il sistema:
   - legge la prima riga come intestazione (e la ignora ai fini dei dati);
   - per ogni riga successiva crea un ingrediente con nome, costo e varianti (e prova ad associare gli allergeni se la colonna è presente);
   - alla fine mostra un messaggio con il **numero di ingredienti importati**.
5. Se una riga ha errori (es. nome vuoto o conflitto), quella riga può essere saltata; le altre vengono comunque importate. Controlla la lista ingredienti dopo il caricamento.

---

## 10. Errori comuni e come evitarli

| Problema | Causa | Soluzione |
|----------|--------|-----------|
| File non riconosciuto / nessun ingrediente importato | Separatore sbagliato (virgola invece di `;`) | Aprire il CSV in un editor e sostituire il separatore tra colonne con `;`. |
| Caratteri strani (Ã², Ã¨) | File non salvato in UTF-8 | Salvare il file con codifica **UTF-8** (o “UTF-8 con BOM” in Excel). |
| “Colonna non trovata” o righe lette male | Intestazione mancante o diversa | Usare come prima riga l'intestazione corretta: Formato A (eventuale `prep_cucina` prima di `allergeni`) oppure Formato B con `prep_cucina` opzionale prima delle colonne allergeni (vedi §5). |
| Costi a zero per tutti | Colonna costo vuota o con formato errato | Controllare che la seconda colonna contenga numeri (es. 0,80 o 0.80). |
| Allergeni non associati | Nome allergene diverso da quello nel sistema | Usare i nomi esatti degli allergeni (es. “Latte”, “Glutine”) e separarli con **virgola** nella colonna allergeni; nel Formato B usare le colonne a spunta. |

---

## 11. Riepilogo template

- **Intestazione Formato A (prima riga, con prep e categoria opzionali):**  
  `nome_ingrediente;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;allergeni;categoria`

- **Intestazione Formato B (foglio con spunte, prima riga — come export portale):**  
  `nome_ingrediente;ordine;costo_eur;abbondante;senza;poco;va_in_cottura;prep_cucina;Glutine;…;Molluschi;categoria;attivo`  
  (Senza `prep_cucina`: dopo `va_in_cottura` segue subito **Glutine**. Colonne finali opzionali. **Non esiste più una colonna colore**: segue sempre la categoria.)

- **categoria (valori consigliati):** `affettato` | `fritto` | `dolce` | `bibita` | `congelato`  
  (In import sono accettati anche sinonimi: bibite, fritti, surgelato, …). Il colore si assegna sempre in automatico dalla categoria — per personalizzarlo si usa il form ingrediente in Admin → Ingredienti, non il CSV.

- **Riga tipo (Formato A):**  
  `NomeIngrediente;0,00;0,00;-0,00;-0,00;0;0;Allergene1,Allergene2;categoria`

- **Riga tipo (Formato B):** campi base + `prep_cucina` + colonne allergeni con `1`/`x`/`sì` o vuoto + opzionale `categoria;attivo`.

- **Separatore colonne:** `;`  
- **Separatore allergeni (nella stessa cella):** `,`  
- **Prezzi:** sempre 2 decimali (es. 1,00 e non 1).  
- **Codifica file:** UTF-8  
- **Estensione:** `.csv`

Se segui questa guida, il file sarà compilato in modo corretto e il caricamento da **CSV** → **Inserisci CSV** nel portale potrà andare a buon fine senza errori.

---

## 12. Registro revisioni guida

| Data | Nota |
|------|------|
| 2026-04-03 | Allineamento con set guide progetto (nessuna modifica alle regole Formato A/B). |
| 2026-04-10 | Colonna opzionale **prep_cucina** (schermata Cucina); export e template Formato B aggiornati; compatibilità file senza colonna. |
| 2026-08-06 | Tipi **categoria** fissi (affettato/fritto/dolce/bibita/congelato) in UI e CSV; sinonimi in import. |
| 2026-08-21 | Rimossa la colonna **colore** dal CSV (import ed export): il colore segue sempre la categoria, non si imposta più da file. Chiarito che `prep_cucina` serve solo per ingredienti senza categoria. |

---

*Ultima revisione: 2026-08-21*
