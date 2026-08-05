# Punto situazione — Dataflows (app ↔ Supabase)

**Agente:** Dataflows  
**Repo:** `D:/APP_PIZZERIA/PizzaManagerApp`  
**Data:** 2026-08-04  
**Principio:** multi-tenant (`tenant_id`); autorità su soldi/stati ordine/permessi lato **RPC SECURITY DEFINER** / RLS; frontend orchestra.

---

## 1. Panoramica

```
Browser (React)
  ├─ AuthContext / TenantContext / PvContext
  ├─ adminService / publicService / clienteAuthService / superadminService
  └─ supabase-js
        ├─ Auth
        ├─ PostgREST (viste public.* → core.*)
        ├─ RPC
        ├─ Realtime (postgres_changes)
        └─ Storage (consegna-prove)
(+ Nest opzionale per auth/write operative)
```

Schema operativo ordini tipicamente in **`core.ordini`** (Realtime); client spesso legge viste legacy `Ordine` / `RigaOrdine` esposte a PostgREST.

---

## 2. Login (staff / cliente / SA)

### 2.1 Flusso

1. `Login.jsx` → `AuthContext.login` → `supabase.auth.signInWithPassword` **oppure** Nest `nestAuthLogin` se abilitato.
2. Post-sessione: `loadUserData(userId)`:
   - **Staff:** `utenti_ruoli` → `ruolo`, `tenant_id`, flag `accesso_*` → `permessiAree`.
   - **Cliente:** `clienti` dove `id = auth.uid()` → `tipoUtente=cliente`, `tenant_id`.
3. Redirect:
   - SA normale → `/superadmin/ingresso` (gate).
   - SA + `support_tenant` / `_qa_console` → `return_to` operativo richiesto.
   - Admin/owner → home admin; operatore → home area da ruolo.
   - Cliente → area cliente / return vetrina.

### 2.2 Tabelle / oggetti

| Oggetto | Uso |
|---------|-----|
| `auth.users` (Supabase Auth) | Identità |
| `public.utenti_ruoli` | Ruolo staff + tenant + permessi aree |
| `public.clienti` | Profilo cliente = stesso UUID auth |
| `public.tenants` | Anagrafica tenant (TenantContext) |
| `public.punti_vendita` | PV (vista; SA all-tenant con mod. 33) |

### 2.3 Timeout / resilienza

- Timeout su `getSession` e query profilo; failsafe loading ~14s.
- Retry breve su timeout `utenti_ruoli`.
- Fallback colonne se errore `42703` (schema vecchio senza `accesso_*`).

---

## 3. Override supporto Super Admin

### 3.1 Flusso

1. Sala QA o Demo: `setSupportTenantOverride(tenantId)` → localStorage + event `pm-support-tenant`.
2. URL: `?support_tenant=<uuid>&_qa_console=1` (+ `_demo_giro=1` in demo).
3. `AuthContext.tenantId` esposto = override se `ruolo === superadmin`.
4. `TenantContext` / `PvContext` ricaricano dati del tenant assistito.
5. `PvContext`: auto-pick PV (altrimenti cassa vuota).
6. Heartbeat: `upsert_support_presence`; lista `sa_list_support_presence` in console QA.
7. Vista `punti_vendita` (SQL 33): SA bypass membership-only.

### 3.2 RPC / storage

| Pezzo | Ruolo |
|-------|--------|
| `upsert_support_presence` | Presence SA su tenant |
| `sa_list_support_presence` | Monitor Sala QA |
| Storage key `pm_sa_support_tenant` | Persistenza override |
| Query `support_tenant`, `_qa_console`, `_demo_giro` | Contesto UI/nav |

**Sicurezza:** override è **solo client + vista SA**; le RPC tenant-scoped devono comunque verificare superadmin o membership — non affidarsi al solo query string lato client.

---

## 4. Cassa — checkout ordine

### 4.1 Flusso

1. UI costruisce carrello (prodotti/formati/modifiche) + metadati: tipo ordine, nome, telefono, slot ritiro/consegna, indirizzo, pagamento, PV, turno.
2. Opzionale: vincolo turno (`turni_cassa_aperto` / parametri `cassa_turno_obbligatorio`).
3. `createOrder(tenantId, payload)` in `adminService`:
   - Nest write se abilitato, altrimenti
   - **`rpc create_order_with_items`** con `p_tenant_id`, `p_totale`, `p_items[]`, note, pagamento, tipo, nome, orario, indirizzo, geo, PV, turno, telefono, idempotency key.
4. Post-create: stampa comanda/ricevuta (client), fidelity movimenti, audit `cassa_audit_log`, refresh lista ordini.
5. Modifica righe successive: `replace_order_items` / `updateOrder*`.
6. Chiusura: `chiudi_giornata`; turni `turni_cassa_apri` / `turni_cassa_chiudi`.

### 4.2 Tabelle / RPC

| RPC / tabella | Ruolo |
|---------------|--------|
| **`create_order_with_items`** | Insert ordine + righe atomico, totali server-side |
| **`replace_order_items`** | Sostituzione righe + totale |
| `Ordine` / `core.ordini` | Testata ordine |
| `RigaOrdine` | Righe |
| `Prodotto`, ingredienti, formati | Listino cassa |
| `anagrafica_clienti`, fidelity_* | Cliente / punti |
| `turni_cassa_*`, `cassa_audit_log` | Turno e audit |
| `chiudi_giornata` | Chiusura contabile giornata |

**Nota display:** split nome/indirizzo in UI non altera lo schema; i campi restano `nome_cliente` / `indirizzo_consegna`.

---

## 5. Vetrina — menu e checkout online

### 5.1 Menu pubblico

1. Resolve tenant: host (`resolve_public_tenant_by_domain`) o id (`get_public_tenant_by_id`) / preview query.
2. Menu: **`get_public_menu_for_domain`** o **`get_public_menu_for_tenant`**.
3. Categorie / ingredienti: `get_public_categories_for_tenant`, `get_public_menu_ingredient_names`.
4. `PublicStore` → `PublicCartContext` (stato client).

### 5.2 Checkout (`PublicOrdineCheckoutPage`)

1. Gate licenza/parametri ordini online.
2. Slot: orari tenant + **`vetrina_slot_carico_oggi`** (capacity forno); filtro fasce piene.
3. Geo indirizzo + poligono PV (`punti_vendita.consegna_area_poligono`).
4. **`createOrder`** stesso RPC cassa (tipo delivery/web, stato spesso in attesa se Stripe).
5. Pagamento: Stripe intent (`onlinePaymentService` + RPC secret/status) → finalize.
6. Notifica staff: **`enqueue_nuovo_ordine_web_notifica`** (outbox).
7. Percorso legacy alternativo: `checkout_ordine` da `CheckoutButton` su ordine già esistente (vincolo 30′ su orario).

### 5.3 Area cliente

| RPC | Uso |
|-----|-----|
| `cliente_lista_propri_ordini` | Storico |
| `cliente_dettaglio_proprio_ordine` | Dettaglio |
| `cliente_aggiorna_proprio_profilo` | Profilo |
| `cliente_get_fidelity_profile` | Fidelity |

---

## 6. Realtime ordini (operativo)

### 6.1 Flusso

1. Hook `useOperativeOrdersLiveRefresh({ tenantId, onRefresh, pollMs })`.
2. Subscribe channel `operative-ordini:{tenantId}`:
   - `postgres_changes` su **`core.ordini`**, filter `tenant_id=eq.{tenantId}`, event `*`.
3. Ad ogni evento → `loadOrders` silent sul reparto (cassa/cucina/bancone/…).
4. **Polling** di sicurezza (≥8s, default 30s) se Realtime fallisce (`CHANNEL_ERROR` / `TIMED_OUT`).
5. Delivery map / altre pagine possono avere channel dedicati; legacy `OrdinePage` usa channel `ordini-realtime`.

### 6.2 Implicazioni

- Tutti i reparti aperti (anche «4 schermate» / finestre QA) vedono lo stesso stream tenant.
- Scritture devono passare da RPC che aggiornano `core.ordini` (altrimenti UI non si allinea).
- Isolamento: filtro Realtime per `tenant_id`; RLS resta la barriera autorizzativa.

---

## 7. Delivery — proof of delivery

### 7.1 Flusso

1. Rider/operatore apre `ConsegnaProofDialog` (firma canvas, foto, note).
2. `markDeliveryConsegnatoWithProof(ordineId, prove, tenantId)`:
   - Se presenti dataUrl → **`uploadConsegnaProveMedia`** su Storage bucket **`consegna-prove`** (`{tenantId}/{ordineId}/…`).
   - Payload riscritto con `storagePath` (niente blob in DB).
3. **`rpc delivery_mark_consegnato_with_proof`** (`p_ordine_id`, `p_prove`).
4. Alternativa senza proof: `delivery_mark_consegnato`.
5. Stati intermedi: **`delivery_update_stato_consegna`** (ASSEGNATO / IN_VIAGGIO / …).
6. Token pubblico rider (se usato): `genera_delivery_token` (`deliveryService.js`).

### 7.2 Oggetti

| Oggetto | Ruolo |
|---------|--------|
| Storage `consegna-prove` | Media firma/foto (policy staff) |
| RPC `delivery_mark_consegnato_with_proof` | Stato CONSEGNATO + JSON prove |
| Colonna/tabella prove (mod. SQL delivery) | Persistenza metadati |
| Realtime ordini | Aggiorna dashboard / mappa |

---

## 8. Altri flussi rilevanti (sintesi)

| Flusso | RPC / tabelle principali |
|--------|---------------------------|
| Go-live SA | `sa_get_go_live_checklist`, `sa_upsert_go_live_checklist` |
| Notifiche outbox | `staff_list_notifiche_outbox`, `staff_retry_notifiche_outbox` |
| Fiscale outbox | `fiscal_outbox`, `fiscal_outbox_export_pending_json` |
| Stripe tenant | `save_tenant_stripe_secret`, `tenant_payment_stripe_configured`, webhook helpers |
| Contesto PV | `set_app_context` |
| Ruoli pizzeria | `aggiungi_ruolo_pizzeria`, tabelle `ruoli_pizzeria` |
| Magazzino DB | `magazzino_fornitori`, `magazzino_ddt`, `magazzino_movimenti` |
| Offline sync | coda locale → `create_order_with_items` |

---

## 9. Diagrammi sequenza (testuali)

### Login staff

```
UI Login → Auth.signIn → utenti_ruoli → set ruolo/tenant/permessi
        → TenantContext.tenants → PvContext.punti_vendita
        → Navigate area
```

### Cassa checkout

```
CassaPage → adminService.createOrder
         → rpc create_order_with_items
         → INSERT core.ordini + righe
         → Realtime * → Cucina/Bancone refresh
         → (opt) print + fidelity + audit
```

### Vetrina

```
Host → resolve tenant RPC → menu RPC → cart locale
    → checkout → slot carico RPC → create_order_with_items
    → (opt) Stripe → enqueue notifica
```

### Support override

```
SA Gate/QA → setSupportTenantOverride + URL
          → Auth.tenantId = target
          → PV auto-pick (vista SA)
          → stesse RPC del tenant come staff, con privilegi SA dove previsto
```

---

## 10. Debito / rischi

1. Verificare che **tutte** le RPC usate in supporto SA validino `superadmin` o membership sul `p_tenant_id` passato dal client.
2. Allineare naming Realtime (`core.ordini`) vs select PostgREST (`Ordine`) nella documentazione team.
3. Retention Storage prove e signed URL se esposti a rider non autenticati.
4. Idempotency key: adottarla sistematicamente su cassa e web per doppio tap / offline replay.
5. Nest path: documentare parity con RPC (stessi campi e stati) per evitare fork comportamentali.

---

## Riferimenti

- `src/app/contexts/AuthContext.jsx`, `PvContext.jsx`
- `src/features/admin/services/adminService.js`
- `src/features/services/publicService.js`
- `src/features/public/services/clienteAuthService.js`
- `src/features/operative/hooks/useOperativeOrdersLiveRefresh.js`
- `src/features/operative/delivery/components/ConsegnaProofDialog.jsx`
- `src/utils/supportTenantOverride.js`, `src/hooks/useSupportPresenceHeartbeat.js`
- `sql/modules/33_sa_support_punti_vendita.sql` (+ moduli delivery/realtime/proof nel catalogo upgrade)
