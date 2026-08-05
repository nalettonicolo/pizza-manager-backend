# Security — punto situazione PizzaManager

**Data:** 2026-08-05  
**Agente:** Security / Red team (`@agents/security.md`)  
**Commit di riferimento:** `41caf48` + working tree (mod. **40**, adapter, verify scripts)  
**Progetto Supabase:** `flfhrwzlrftuhkrfwzse`

---

## 1. Threat model multi-tenant (sintesi)

| Asset | Attore | Minaccia | Controllo attuale | Residuo |
|-------|--------|----------|-------------------|---------|
| Ordini / totali / turni | Anon / tenant B | Lettura o scrittura cross-tenant (IDOR) | RLS + RPC `SECURITY DEFINER` con assert su `auth.uid()` / `utenti_ruoli` | Smoke cross-tenant manuale; CI JWT A/B ancora da automatizzare |
| Segreti Stripe / Edge | Client browser | Leak `sk_*` / webhook secret via PostgREST | Mod. **34**: EXECUTE solo `service_role` su `get_stripe_*_edge`, `edge_stripe_*`, fiscal claim | Verificare periodicamente GRANT dopo nuove RPC |
| RPC admin / SA | Anon | Invocazione senza sessione | Mod. **34–35**: `REVOKE` da `PUBLIC`/`anon`; resta `authenticated` con assert interno | Rumore advisor 0028/0029 intenzionale su RPC vetrina/staff |
| Presence supporto | Qualsiasi autenticato | Spoofing `p_tenant_id` | Mod. **30**: tenant solo da `auth.uid()`; SA non pubblica presence | Contratto unit + assert SQL |
| Override `support_tenant` | Staff non-SA | Impersonazione tenant via query/localStorage | Frontend: `tenantId` effettivo override **solo se** `ruolo === "superadmin"` (`AuthContext`) | Query string resta leggibile; senza ruolo SA non cambia tenant DB |
| Vista `punti_vendita` | SA in Sala QA | PV vuoti → cassa vuota | Mod. **33**: bypass SA in vista `security_invoker` | GRANT SELECT anche ad `anon` (vista filtrata: senza membership → vuoto) |
| Storage proof delivery | Rider/staff altro tenant | Accesso foto/firma | Mod. **37**: bucket privato `consegna-prove`, path `{tenant_id}/…`, policy membership | Retention / signed URL se serve policy retention |
| Realtime `core.ordini` | Client sottoscritto | Leak eventi altri tenant | Mod. **36** + filtri client su `tenant_id`; replica identity FULL | Audit kiosk / azione ancora backlog |
| Tenant branding pubblico | Anon | Enumerazione UUID + dati operativi | Mod. **39** `get_public_tenant_by_id` (solo attivi, campi whitelist) | Vedi §3 `parametri_operativi` |
| Password deboli | Attaccante online | Credenziali leakate | HIBP leaked passwords | **Bloccato da piano Supabase Pro+** |

Principio invariante: **nessuna logica critica di autorizzazione solo nel frontend**; UX sì, autorità su soldi / permessi / isolamento sul DB.

---

## 2. Hardening moduli 34–38 (agosto 2026)

### 34 — `sql/modules/34_revoke_edge_secrets_and_search_path.sql`

- Helper `_pm_revoke_exec_client_roles` (poi non invocabile da client).
- **P0 solo `service_role`:** `get_stripe_secret_for_tenant_edge`, `get_stripe_webhook_secret_for_tenant_edge`, `get_tenant_id_by_stripe_payment_intent`, tutte le `edge_stripe_*` / `edge_get_ordine_*`, `claim_fiscal_outbox_batch`, `complete_fiscal_outbox_item`.
- Trigger / helper interni (sync auth, cottura/formati/ingredienti CRUD DEFINER, ecc.): revoca EXECUTE client.
- Admin/SA sensibili (`save_tenant_stripe_secret`, `sa_*`, `aggiungi_ruolo_pizzeria`, …): mai `anon`.
- `search_path` fissato su helper `pm_*` (advisor 0011).

### 35 — `sql/modules/35_revoke_anon_auth_required_rpcs.sql`

- REVOKE `anon` su RPC che già richiedono `auth.uid()` (`create_order_with_items`, turni cassa, delivery, cliente_*, fiscal export staff, `upsert_support_presence`, …).
- Riduce superficie advisor 0028 senza cambiare il contratto funzionale.

### 36 — `sql/modules/36_realtime_ordini_publication.sql`

- `core.ordini` in publication `supabase_realtime`.
- `REPLICA IDENTITY FULL` per filtri tenant su UPDATE/DELETE più affidabili (cucina/bancone/delivery).

### 37 — `sql/modules/37_storage_consegna_prove.sql`

- Bucket privato `consegna-prove` (5 MB, immagini).
- Policy SELECT/INSERT/UPDATE/DELETE: staff del tenant path **oppure** superadmin.
- Helper `pm_storage_path_tenant_id` (search_path fissato in 38).

### 38 — `sql/modules/38_advisor_residuals_turni_search_path.sql`

- `search_path` su `pm_storage_path_tenant_id`.
- Auto-lock helper revoke.
- Policy RLS complete su `public.turni_operatori` (staff tenant + SA); **nessun GRANT table** ad `anon`/`authenticated` (operativo via RPC `turni_cassa_*`).

---

## 3. RPC pubblica `get_public_tenant_by_id` (modulo 39)

**Perché:** post-hardening, anon non legge più `public.tenants` (RLS). Anteprima SaaS (`/preview`, `/negozio`, `?tenant=` / `support_tenant`) restava senza branding → menu “vuoto” o fallback sintetico.

**Contratto (SECURITY DEFINER):**

- Input: `p_tenant_id UUID`
- Solo tenant `attivo` e `deleted_at IS NULL`
- Payload JSONB whitelist: `id`, `nome`, `slug`, `logo_url`, `attivo`, `piano`, `parametri_operativi`, `orari_settimana`, `indirizzo`
- GRANT: `anon`, `authenticated`

**Nota esposizione `parametri_operativi`:** mitigata dal **modulo 40** (`pm_public_parametri_operativi`): le RPC pubbliche espongono solo chiavi vetrina (ordini online, tema, promo, poligono, capacity, fidelity display). Non più il blob operativo completo (cassa/fiscale/notifiche).

Client: `src/features/services/publicService.js` → `fetchPublicTenantById` preferisce la RPC; fallback `.from('tenants')` (spesso fallisce per RLS) poi sintetico minimale.

**Verifica:** applicata su remoto + allineata in `schema_completo_pizzamanager.sql`; smoke anteprima su tenant **Francy Pizza** OK dopo `41caf48`.

---

## 4. `support_tenant` solo Super Admin

| Layer | Comportamento |
|-------|----------------|
| Query / localStorage | Marker `support_tenant`, `_qa_console`, `_demo_giro` (Sala QA / Demo live) |
| `AuthContext` | Override applicato al `tenantId` **solo se** `ruolo === "superadmin"`; `isSupportTenantMode` analogo |
| Login | SA senza marker → `/superadmin/ingresso`; con QA → ritorno a path operativo richiesto |
| DB vista PV | Mod. 33: SA vede tutti i PV; altrimenti solo membership |
| Presence | SA non pubblica presence cross-tenant (mod. 30) |

**Rischio residuo UX:** un URL con `?support_tenant=<uuid>` in mano a un non-SA non impersona il tenant a livello AuthContext; può comunque influenzare risoluzione **pubblica** del menu (stesso UUID usato dalla vetrina). Accettabile se gli UUID non sono segreti di sicurezza (sono identificatori); non sostituisce RLS sugli ordini.

---

## 5. Secrets Stripe

| Operazione | Ruolo atteso |
|------------|--------------|
| `save_tenant_stripe_secret` / webhook | `authenticated` + assert admin/SA (no anon) |
| `get_stripe_secret_for_tenant_edge` / webhook / payment intent map | **solo `service_role`** (Edge) |
| `edge_stripe_*` mutate | **solo `service_role`** |
| Chiavi in repo / bundle Vite | Vietate; solo env / Dashboard |

Stato prodotto Francy: chiavi **test** (`*_test_`); smoke **live** in attesa di `pk_live` / `sk_live` / `whsec` (blocco esterno, non regressione sicurezza codice).

---

## 6. Advisor sicurezza: 106 → 43

Snapshot documentato in `docs/MACROFASI_SVILUPPO.md` / backlog (post ciclo 34–38):

- **Prima:** ~106 WARN advisor sicurezza.
- **Dopo:** **43** WARN.
  - **42** rumore atteso: RPC DEFINER intenzionalmente eseguibili da `anon` (vetrina) o `authenticated` (staff con assert) — advisor 0028/0029.
  - **1** HIBP / leaked password protection: richiede upgrade Dashboard a piano **Pro+** (API Free rifiuta il toggle).

Performance advisors: fuori scope di questo documento; rieseguire `get_advisors` periodicamente dopo ogni modulo SQL.

---

## 7. HIBP Pro+

- Controllo Auth Supabase “Leaked password protection” (Have I Been Pwned).
- **Stato:** non attivabile sul piano attuale senza **Pro+**.
- **Azione:** quando disponibile il piano → Dashboard Auth → abilitare; verificare login con password note come leakate in staging.
- Fino ad allora: policy password minime + educazione gestori; non è un substitute di HIBP.

---

## 8. Checklist security (rilascio / post-patch)

- [ ] Ogni nuova tabella esposta a PostgREST: RLS + policy documentate; no `GRANT ALL` ad anon.
- [ ] Nuova RPC `SECURITY DEFINER`: `SET search_path`, REVOKE `PUBLIC`, grant minimo, assert tenant/ruolo, review `@agents/security.md`.
- [ ] Segreti Stripe/Edge: solo `service_role`; smoke che anon/authenticated ricevano permission denied.
- [ ] Smoke: utente tenant A non vede/modifica ordini tenant B.
- [ ] `support_tenant` / Demo live: solo account SA; staff non cambia tenant effettivo.
- [ ] Anteprima pubblica: menu/branding OK; `parametri_operativi` solo whitelist mod. **40** (`npm run verify:public-po`).
- [ ] Storage `consegna-prove`: path con `tenant_id` corretto; bucket non pubblico.
- [ ] Realtime: subscription filtrata per `tenant_id`.
- [ ] Nessun secret in repo (`.env` gitignored); CI secrets ok.
- [ ] Advisor: delta documentato; HIBP in backlog Pro+.
- [ ] Webhook Stripe: verifica firma + idempotenza (quando live).
- [ ] Deploy SQL: modulo in `sql/modules/` + riga in `sql_upgrade.sql` + apply remoto nella stessa sessione.

---

## 9. Verdetto Security (per il supervisore)

**Non bloccante** al 2026-08-05: hardening 34–40, segreti Edge ristretti, Demo live gated SA, whitelist PO pubblica verificata.

**Follow-up (esterni / CI):**

1. ~~Restringere payload `parametri_operativi`~~ → **fatto** (mod. 40).
2. Attivare HIBP su Pro+.
3. Stripe live + smoke pagamenti.
4. Secrets `RLS_JWT_*` per CI A/B (script già pronto).

---

*Documento Security — aggiornato 2026-08-05*
