# Punto situazione — Architettura

**Progetto:** PizzaManager  
**Data revisione:** 2026-08-04  
**Ruolo documento:** decisioni di confine (dove vive la logica). Nessuna specifica di implementazione.

---

## 1. Contesto e data revisione

| Campo | Valore |
|--------|--------|
| Repo | PizzaManagerApp |
| Revisione | **2026-08-04** |
| Stack dominante | React + Vite (SPA), Supabase (Postgres + Auth + RLS + RPC + Realtime + Edge), Nest opzionale (`VITE_API_URL`) |
| Principio guida | **Supabase first**: autorità su soldi, totali, permessi e isolamento tenant sul DB; SPA = UX; Nest/Edge solo dove serve segreto server-side |

Il prodotto è un SaaS multi-tenant per pizzerie: vetrina pubblica, area cliente, admin locale, operativo (cassa/reparti), superadmin piattaforma (tenant, piani, Sala QA, Demo live).

Questa revisione incorpora l’hardening SQL (moduli **33–39**), Realtime ordini, RPC pubblica tenant-by-id, e i flussi SA di supporto/demo.

Riferimenti correlati: `docs/ARCHITETTURA_API_E_RUOLI.md`, `docs/SICUREZZA_MULTI_TENANT_SPRINT.md`, `agents/architecture.md`.

---

## 2. Stack e confini

```text
Browser (SPA React/Vite)
  ├─ supabase-js → Postgres + RLS + viste + RPC DEFINER + Realtime
  ├─ VITE_API_URL (opzionale) → Nest
  └─ Edge Functions → Stripe, fiscal/notifiche outbox
```

| Layer | Cosa deve contenere | Cosa non deve contenere |
|--------|---------------------|-------------------------|
| **SPA** | Routing, UX, composizione chiamate, override UI Sala QA / Demo | Fonte di verità su totali ordine, grant cross-tenant, segreti |
| **Supabase DB** | Schema, RLS, RPC DEFINER, Realtime | Logica UI |
| **Edge** | Webhook, segreti Stripe, worker outbox | CRUD UI; bypass RLS esposto al browser |
| **Nest** | Path già flaggati | Seconda business logic senza piano di deprecazione DB |

---

## 3. Multi-tenant e isolation

- Ogni riga di dominio porta **`tenant_id`**.
- Membership: `utenti_ruoli` (staff/SA), `clienti` (cliente).
- Tenant effettivo SPA: `AuthContext.tenantId`, override `support_tenant` **solo Super Admin**.
- Autorità: RLS + viste `security_invoker` + RPC DEFINER + REVOKE (mod. 34–35).
- Eccezioni controllate: anon vetrina (RPC pubbliche); SA Sala QA / Demo; Edge `service_role`.

**Regola:** nessuna feature critica con filtro `tenant_id` solo nel frontend.

---

## 4. Aree prodotto → dove vive la logica

| Area | UI (SPA) | Autorità |
|------|----------|----------|
| Vetrina | `publicService`, `PublicStore` | Menu pubblico + `get_public_tenant_by_id` |
| Checkout web | Carrello, UX | RPC capacity/antifraud; Stripe Edge |
| Cliente | `/cliente/*` | RPC `cliente_*` |
| Admin tenant | `/admin/*` | Query/RLS + RPC |
| Cassa | `CassaPage` | `create_order_with_items`, turni |
| Reparti | Layout operativo | Letture + Realtime `core.ordini` |
| Delivery | UI + proof | RPC delivery + Storage |
| Superadmin / Demo live | Gate, Sala QA | Ruolo SA + override tenant |

---

## 5. Decisioni recenti rilevanti

- **34–35:** REVOKE edge/secrets e anon su RPC login-only.
- **36:** Realtime `core.ordini`.
- **39:** `get_public_tenant_by_id` per anteprima post-hardening.
- **33:** vista PV con bypass SA (Sala QA).
- **Demo live + gate SA:** navigazione operativa su dati reali senza altri login.

---

## 6. Gap architetturali / rischi

| Gap | Direzione |
|-----|-----------|
| Duplicazione Nest ↔ Supabase | Nest facade → stesse RPC |
| `adminService` / `CassaPage` monolitici | Spezzare per dominio |
| Dati in localStorage | Migrare a Supabase |
| Dual auth | Un percorso primario per ambiente |
| Drift SQL modules ↔ schema_completo | Consolidamento periodico |

---

## 7. Prossimi passi architetturali

1. Congelare autorità ordini/turni/pagamenti sul DB.
2. Contratto vetrina post-hardening standardizzato.
3. Realtime: filtri tenant/PV su tutti i subscriber.
4. Inventario bypass SA; test isolamento JWT A/B in CI.
5. Smontare monolitì senza cambiare confini layer.

---

## 8. Riferimenti file

`AppRouter.jsx`, `AuthContext.jsx`, `adminService.js`, `publicService.js`, `supportTenantOverride.js`, `demoGiro.js`, `SuperadminGatePage.jsx`, `sql/modules/33–39_*.sql`, `schema_completo_pizzamanager.sql`, `agents/architecture.md`.

---

*Fine documento — Architettura, revisione 2026-08-04.*
