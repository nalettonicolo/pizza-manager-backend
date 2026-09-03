# Backlog e stato sviluppo (vista engineering / product)

Questo documento fissa **cosa è realistico completare in codice**, cosa è **bloccato da dipendenze esterne**, e cosa resta **multi‑sprint / multi‑quarter**. Non sostituisce la tabella commerciale in `src/config/serviziRoadmapSteps.js` (percentuali per servizio), ma la contestualizza.

---

## 1. Principi (da SDM)

| Principio | Implicazione |
|-----------|----------------|
| **Nessun “big bang”** | Le voci enterprise (RT, POS certificati, offline DR, API pubbliche, SSO) richiedono mesi e spesso vendor/fornitori. |
| **Database prima** | Ogni feature che tocca RPC/viste deve essere riflessa su Supabase: baseline `sql/schema_completo_pizzamanager.sql` per ambienti nuovi; patch in `sql/sql_upgrade.sql` per il delta. |
| **Fonte di verità roadmap UI** | `SERVIZI_ROADMAP_STEPS` in `serviziRoadmapSteps.js` — aggiornare `nota`/`resto` quando si consegna qualcosa di verificabile. |
| **Definition of Done** | Per una feature “chiusa”: codice + migration (se serve) + comportamento verificabile in staging o checklist manuale. |

---

## 2. Completato di recente (repo, verificabile)

- **Modulo SQL 25**: web `IN_ATTESA` Stripe, capacity forno (`vetrina_slot_carico_oggi` + assert), antifraud (8/ora + blocklist), proof delivery (`consegna_prova`), stub `api_oauth_clients`.
- **Checkout vetrina**: blocco fasce piene; Stripe checkout path sbloccato lato RPC.
- **Delivery**: proof firma/foto su Storage `consegna-prove` (mod. 37), mappa live Realtime, sort nearest-neighbor, rider PWA.
- **Notifiche / fiscale**: adapter pattern Edge (stub SMTP/SMS/WA e RT/SDI); coda outbox come log; claim fiscal solo `service_role`.
- **CI keep-alive Supabase**: retry e check secret (workflow verde).
- **Macrofasi 1–5**: core completato (vedi `MACROFASI_SVILUPPO.md`); **Fase 6** = produzione hard + adapter reali.
- **2026-08-03**: hardening RPC (34–35); Realtime ordini (36); magazzino hub DB; stampa comanda web Francy; guide DNS; SA gate + Sala QA; proof Storage (37); advisor residui (38); deploy hosting produzione.
- **2026-08-20**: batch Chek-Sviluppi CA-10/11/12/14, CL-09/10, OP-07, OW-05; checkout profilo + geocode Nominatim-first; logo landing; priorità in `docs/punto-situazione/11_priorita_operative.md`.
- **2026-08-28**: modale "Modifica pizza" reso adattivo allo schermo (Admin → Menù → Pizze, scoped a `.pizza-modal-shell` per non toccare il modale di personalizzazione Cassa); SMTP/email per tenant (Clienti → Email e SMTP: no-reply/info/support + SMTP locale, usato dalle notifiche outbox se configurato, altrimenti i secret di piattaforma — resta distinto dall'**SMTP Auth** globale, ancora bloccato, vedi §3); registro attività Super Admin in diretta (chi ha fatto cosa, esito, note — modulo SQL 113).
- **2026-08-30 — audit di sicurezza (moduli SQL 114–119)**: guardia anti-escalation su `utenti_ruoli` (un non-superadmin non può più auto-assegnarsi `superadmin`); trigger di integrità sul totale ordine per gli ordini web (anti-frode pagamenti online); `fidelity_applica_movimento` resa una RPC atomica (eliminata la race read‑modify‑write lato client sul saldo punti); autenticazione dei cron verso le Edge Function via header `x-cron-secret` (prima chiunque conoscesse l'URL poteva invocarle con la sola anon key); ottimizzazione RLS (`auth.uid()` → `(select auth.uid())` su 7 policy) e consolidamento policy permissive ridondanti.
- **2026-08-30 — flusso ordine allineato al reale (moduli 120–121)**: nuovo stato `IN_COTTURA` tra "In preparazione" e "Pronto" — prima il tasto "In forno" dei Pizzaioli portava l'ordine direttamente a Pronto, saltando la fase di cottura; ora riflette il reparto Bancone come step di chiusura reale (ritiro → Consegnato, domicilio → Pronto poi assegnato al Delivery). Corretti in questo passaggio anche: il tasto "In consegna" di Bancone sul domicilio (prima chiudeva l'ordine come Consegnato invece di passarlo al Delivery), la doppia possibilità di chiudere lo stesso ordine da due schermate diverse, e l'incoerenza chip/card su Bancone. Pagina Super Admin → Flussi aggiornata con la mappa attuale reparto‑per‑reparto e le correzioni applicate.
- **2026-08-30 — sessione pony/rider (moduli 122–129), corretta in giornata**: prima implementato un meccanismo "pony a slot" (`core.rider.pony_slot`, route `/operative/pony/1` e `/2`) per far condividere a due persone lo stesso login come due rider distinti — **premessa sbagliata**: nella pizzeria reale ogni pony ha il proprio login individuale, quindi il caso d'uso non esiste. Rimosso lo stesso giorno (modulo 129) tornando al modello originale "un login = un rider"; resta invariato tutto il resto introdotto nella stessa sessione (il rider imposta il proprio nome visualizzato, `core.ordini.nome_pony` come snapshot del nome al momento della presa in carico, vista cassa delle consegne odierne, assegnazione manuale di una consegna da cassa).
- **2026-08-30 — hardening XSS pagine pubbliche**: `BlogPostPage.jsx`, `LandingPageView.jsx`, `FaqSection.jsx`, `SoftwareApplicationSchema.jsx` iniettavano il blocco `<script type="application/ld+json">` con `JSON.stringify()` non escapato — un titolo articolo/domanda FAQ contenente `</script><script>...</script>` avrebbe chiuso il tag in anticipo ed eseguito script arbitrario su ogni visitatore (stored XSS). Nuovo helper `src/utils/safeJsonLd.js` (escape di `<` in `<`) applicato ai 4 punti. Avviato in parallelo un audit di sicurezza sistematico (OWASP Top 10) su tutti i 116 moduli SQL, i ~490 file frontend e le 35 Edge Function — risultati e fix a seguire.

---

## 3. Non completabile “tutto” senza input esterni

| Area | Blocco |
|------|--------|
| **Pagamenti online live** | Account Stripe **live** tenant + webhook produzione (oggi Francy ha solo `*_test_`). |
| **Registratore telematico / SDI** | Vendor RT + commercialista — adapter stub pronto. |
| **POS certificati (PAX/Ingenico)** | SDK/protocolli e ambiente hardware di test. |
| **SMTP Auth cliente** | Config Dashboard Supabase (`no-reply@pizzamanager.it`). |
| **Auth HIBP (leaked passwords)** | Piano Supabase **Pro+** (API Free rifiuta il toggle). |
| **Supporto SLA / Account manager** | Organizzazione commerciale, non repository. |
| **Dominio reale Francy** | Registrar + hostname + Firebase custom domain (guide in Go-live). |

---

## 4. Backlog tecnico per area (sintesi)

| Epic | Stato | Prossimo passo tecnico tipico |
|------|------|-------------------------------|
| **Ordini online** | WIP ~84% | Smoke Stripe **live** (stampa comanda web già ON Francy). |
| **Consegne** | WIP ~84% | VRP più ricco / signed URL retention se serve (Storage già OK). |
| **Tablet / Realtime** | WIP ~72% | Audit azione e modalità kiosk (Realtime già attivo). |
| **Magazzino** | WIP ~78% | Giacenza valorizzata / inventari (fornitori-DDT già DB). |
| **Sicurezza DB** | Avanzato | Moduli 114–119 applicati (escalation, integrità ordine web, fidelity atomica, cron secret, RLS initplan); HIBP su Pro+; il grosso dell'advisor `security_definer_function_executable` è rumore intenzionale (RPC eseguibili da `authenticated`/`anon` per design) — cresce con ogni nuova RPC, non è più un numero singolo tracciato. Audit OWASP applicativo (injection/IDOR/XSS/auth) in corso su tutto il repo, vedi entry 2026-08-30 sopra. |
| **API pubbliche** | Todo ~42% | Nest OAuth token su `api_oauth_clients`. |
| **Fiscale IT** | Parziale | Completare `rt-sdi.ts` quando vendor scelto. |

**Idea segnalata 2026-08-22 — IMPLEMENTATA (era bloccata da una premessa sbagliata, vedi cronologia sotto):** dal pannello "Paga online" in Cassa, tasto che apre WhatsApp con il link di pagamento pre-compilato nel messaggio.
**2026-08-22 — verificato prima di implementare:** l'idea presupponeva che esistesse già "il link pay-by-link" da mettere nel messaggio. Non era così: `runUnifiedPayByLinkSetup()` per Stripe creava solo un PaymentIntent (client_secret, usato da un checkout Stripe Elements **in pagina**, non un URL condivisibile) e per gli altri provider registrava solo un "intent in attesa" senza nessun link. Non esisteva nel repo nessuna pagina cliente tipo `/paga/:id` a cui puntare.
**2026-08-22 — costruita la pagina di pagamento ospitata:** nuova rotta pubblica `/paga/:intentId` ([PagamentoLinkPage.jsx](../src/features/public/pages/PagamentoLinkPage.jsx)), senza login, riusa `StripePaymentForm` già usato nel checkout vetrina. Nuova Edge Function `payment-link-checkout` (anonima, `verify_jwt=false`: l'autorizzazione è l'id casuale di `payment_link_intents`, non un JWT) che crea/riusa il PaymentIntent Stripe **solo quando il link viene davvero aperto** — non più al momento della registrazione in cassa, evitando PaymentIntent orfani per link mai aperti. Nuove RPC `edge_payment_link_intent_get` / `edge_payment_link_attach_stripe_intent` (modulo SQL 59); `edge_stripe_mark_payment_succeeded`/`_failed` ora riflettono l'esito anche su `payment_link_intents`, non solo su `core.ordini`. `runUnifiedPayByLinkSetup()` semplificato: per Stripe ora crea solo l'intent + `payment_url`, senza più chiamare l'Edge Function autenticata (che comunque richiedeva un abbinamento cliente↔ordine mai vero per un ordine preso a telefono da cassa — bug latente scoperto e rimosso in questo passaggio). Tasto "📱 Invia su WhatsApp" nel pannello "Paga online" di Cassa, con link `wa.me` precompilato. SumUp resta non collegato (nessuna Edge Function dedicata, come prima).

**Stati ordine delivery da rivedere (segnalato 2026-08-22, esplicitamente rimandato — "da sistemare più tardi"):** il pannello Delivery/Pony mostra "IN_PREPARAZIONE" subito dopo l'accettazione cassa. Il flusso voluto invece è:
1. Ordine ricevuto e accettato → stato "In attesa" (non ancora "in preparazione").
2. Stato passa a "In preparazione" solo quando mancano ~30 minuti all'orario di consegna previsto (transizione basata sul tempo, non sull'accettazione).
3. Gli stati successivi ("In forno" / "In consegna") restano affidati ai tablet operativi (cucina/pizzaioli) o al pony che prende in carico la consegna — non cambia.
Richiede probabilmente un nuovo stato intermedio (o un calcolo a display basato su `consegna_prevista_at - now()`) sul pannello Delivery — da progettare con calma, non un fix immediato.

**Agente-chat "marketing" senza rate-limit (segnalato 2026-08-30, esplicitamente rimandato):** `supabase/functions/agente-chat/index.ts` in modalità `marketing` è completamente anonima e chiama l'API a pagamento di Anthropic ad ogni messaggio, senza alcun limite per IP/sessione né cap giornaliero — un vettore di esaurimento risorse/costo illimitato a carico di PizzaManager (non del tenant). Anche `sessione_id` (`nuovaSessioneId()` in `agenteChatService.js`) è debole/prevedibile e non autenticato: chi indovina/riusa l'id altrui può accodare messaggi nella conversazione salvata di qualcun altro (inquinamento dati, non lettura). Fix proposto quando si deciderà di procedere: contatore atomico in Postgres per sessione_id/IP con soglia e tetto giornaliero, `sessione_id` generato con `crypto.randomUUID()`.

---

## 5. Ordine di lavoro consigliato (ora)

1. **Stripe live** Francy (chiavi) + smoke pagamento web.
2. **Dominio menu** Francy (DNS + Firebase + Auth redirects).
3. Adapter SMTP / RT-SDI quando ci sono credenziali.
4. Enterprise: billing Stripe tenant / OAuth quando in scope.

---

## 6. Riferimenti

| Documento | Contenuto |
|-----------|-----------|
| `docs/MACROFASI_SVILUPPO.md` | Macrofasi 1–5 done, Fase 6. |
| `docs/GO_LIVE_ORDINI_WEB.md` | Produzione oggi senza adapter. |
| `src/config/serviziRoadmapSteps.js` | Percentuali UI Super Admin. |
| `src/content/dnsHostGuides.js` | Guide DNS per registrar. |
| Canvas Cursor / Guide SA | `docs/punto-situazione/` · slug `punto-situazione-*` |

---

*Ultima revisione: 2026-08-30*
