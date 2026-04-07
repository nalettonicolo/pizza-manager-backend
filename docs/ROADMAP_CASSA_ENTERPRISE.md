# Roadmap enterprise: cassa → offline → fiscale (IT)

Documento di **pianificazione tecnica** allineato alle decisioni prodotto. Non sostituisce consulenza legale o commercialista per adempimenti fiscali.

---

## Decisioni vincolanti (fonte di verità)

| Priorità | Contenuto |
|----------|-----------|
| **1** | Completare per prime le funzionalità **cassa** (turni, incassi, coerenza PV, audit pagamenti, osservabilità dove serve). |
| **2** | Poi **offline / disaster recovery** (coda locale, sync idempotente, conflitti). |
| **3** | **Allineamento database** prima e durante ogni blocco: stesso schema su ambienti collegati all’app (`supabase db push` o SQL Editor da `sql/sql_upgrade.sql` / `supabase/migrations/`). |
| **4** | Evolvere i **contesti in ordine di importanza e a blocchi** (vedi sotto): niente “tutto insieme”. |
| **5** | Strutturare il perimetro per **regolamentazione fiscale italiana** (registratore telematico / corrispettivi / tracciati richiesti dal normativo vigente), con integrazioni hardware/fornitore quando definite. |

---

## Fase 0 — Allineamento database (sempre prima di una release cassa)

1. **Migrations in ordine** (nome file = ordine cronologico): es. `20260406115500_turni_operatori_base_if_missing.sql` → `20260406120000_cassa_turni_rpc.sql`.
2. **`punti_vendita`**: se è una **VIEW**, non si possono creare FK verso di essa; le migration nel repo saltano il vincolo in quel caso. Le RPC che fanno `SELECT` sulla view restano valide.
3. **`utenti_ruoli`**: le RPC turni usano `attivo`; assicurarsi che la colonna esista (vedi `post_remote_schema_unified`).
4. **Checklist post-deploy**: funzioni `turni_cassa_*` presenti; tabella `turni_operatori` esistente; test manuale Operative → Turni + flag parametri `cassa_turno_obbligatorio`.

Riferimento comandi: `DEPLOY_COMANDI.md`.

---

## Blocco A — Cassa (prima onda)

Ordine suggerito **dentro** il blocco cassa (dalla base alla “cintura”):

| # | Tema | Note |
|---|------|------|
| A1 | **Turno obbligatorio** + apertura/chiusura + riconciliazione | RPC + UI + parametro; **ordini collegati al turno** (`core.ordini.turno_operatori_id`, param. RPC `p_turno_operatori_id`) — migration `20260406140000_ordine_turno_operatori.sql`. Report chiusura in iterazione successiva. |
| A2 | **Multi‑PV** coerente | Ordine/listino/chiusura legati al PV attivo; report consolidato gruppo in iterazione successiva se serve al business. |
| A3 | **Pagamento misto enterprise** | Split illimitato, arrotondamenti, sconti riga/globale, **audit** immutabile sugli importi applicati. |
| A4 | **Osservabilità cassa** | Metriche latency checkout, errori RPC cassa, correlazione `tenant_id` / `ordine_id` (stack scelto: Sentry / OTel / altro). |
| A5 | **Sicurezza** | Verifica RLS/RPC su percorsi cassa; test segregazione tenant. |
| A6 | **Accessibilità / i18n** (flussi critici) | WCAG 2.2 su conferma pagamento e chiusure; date/valute/IVA coerenti. |

**Omnicanalità** (stesso motore ordine: cassa, kiosk, QR tavolo): trattarla come vincolo architetturale durante A2–A3 (una sola pipeline di totali e sconti), non come ultimo refactor.

---

## Blocco B — Offline / disaster recovery (seconda onda)

Dopo che la cassa “online” è stabile e misurabile (A4):

| # | Tema | Note |
|---|------|------|
| B1 | **Coda locale** | Persistenza ordini/chiusure in attesa (es. IndexedDB). |
| B2 | **Sync idempotente** | Chiavi idempotenza lato server; retry con backoff. |
| B3 | **Conflitti** | Regole deterministiche (es. ultimo writer, o blocco su chiusura fiscale). |

Dipendenze: schema DB allineato; RPC stabili; eventuali vincoli di un futuro modulo fiscale (non scrivere offline ciò che il RT non può accettare).

---

## Blocco C — Regolamentazione fiscale italiana (quadro tecnico)

**Disclaimer:** questo paragrafo descrive solo **ambiti tecnici tipici** (modelli dati, integrazioni, tracciabilità). Le obbligazioni esatte dipendono dalla normativa applicabile al tuo caso (tipo esercente, dispositivo, regime). Va validato con un professionista abilitato.

### C1 — Perimetro funzionale (da definire con il fornitore/dispositivo)

- Registratore telematico / trasmissione corrispettivi / protocolli del dispositivo certificato.
- Gestione **chiusure** e **annulli** secondo le regole del dispositivo e del gestionale.
- Esportazioni richieste (es. tracciati XML / flussi verso AdE o intermediari), **solo** dopo scelta del canale ufficiale.

### C2 — Cosa conviene preparare in app (indipendentemente dal vendor)

- **Numerazioni e stati** immutabili per documento emesso (append-only o revision controllata).
- **Audit** su ogni rettifica di importo, sconto, annullo (chi, quando, motivazione).
- **Separazione netta** tra “ordine gestionale” e “documento fiscale emesso” (anche se poi si collegano 1:1).
- **Ambiente di test** o sandbox fornita dal vendor RT, prima della produzione.

### C3 — Ordine di implementazione suggerito

1. Modello dati + audit + export log (senza hardware).
2. Integrazione con **un** protocollo / dispositivo scelto (PAX, Ingenico, middleware, ecc.).
3. Chiusure e annulli certificati allineati al manuale del dispositivo.
4. Hardening RLS e backup per dati fiscalmente rilevanti.

---

## Collegamenti

- Questionario fiscale / stakeholder (IT, non consulenza legale): `docs/ANALISI_PERIMETRO_FISCALE_E_QUESTIONARIO_SVILUPPO.md`.
- Questionario **gestionale completo** (scope, moduli, priorità, migrazione dati): `docs/ANALISI_GESTIONALE_COMPLETO_E_QUESTIONARIO_SVILUPPO.md`.
- Roadmap servizio UI: `src/config/serviziRoadmapSteps.js` (`ordini_cassa`).
- Architettura route vs stato: `docs/ARCHITETTURA_E_STATO.md`.
- Script SQL incrementali: `sql/sql_upgrade.sql`.

---

*Ultima revisione: 2026-04-05*
