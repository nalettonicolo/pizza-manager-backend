# Macrofasi sviluppo PizzaManager

Piano operativo per completare la piattaforma **fase per fase**, con Definition of Done per ogni macrofase. Allineato a `BACKLOG_E_STATO_SVILUPPO.md` e `serviziRoadmapSteps.js`.

---

## Panoramica

| Fase | Nome | Obiettivo | DoD sintetico | Stato |
|------|------|-----------|---------------|-------|
| **1** | Go-live piattaforma | Produzione stabile, DB e auth allineati | Deploy OK, SQL applicati, preview/menu, redirect Auth | ✅ Completata |
| **2** | Cliente end-to-end | Area cliente completa post-ordine | Storico ordini, profilo con geo, checkout→ordini | ✅ Completata |
| **3** | Back-office persistente | Admin su Supabase, non localStorage | Magazzino 14, contabilità 16, incassi DB | ✅ Completata |
| **4** | Operativo & consegne | Sala, rider, notifiche | Delivery UX, webhooks ordine, fidelity cliente | ✅ Completata (core) |
| **5** | Piattaforma enterprise | Superadmin, billing, DR | Catalogo/piani su DB, offline queue, export fiscal | ✅ Completata (core) |

**Regola:** ogni patch SQL in `sql/modules/` va applicata subito con `npm run sql:apply -- sql/modules/NN_*.sql`.

---

## Fase 1 — Go-live piattaforma ✅

- Moduli SQL 14–20 applicati
- Preview tenant fallback + `VITE_PUBLIC_DEMO_TENANT_ID`
- Deploy hosting + sync redirect Auth

---

## Fase 2 — Cliente end-to-end ✅

- Modulo 20: RPC ordini cliente
- `ClienteOrdiniPage`, profilo con mappa, `clienteAuthService`

---

## Fase 3 — Back-office persistente ✅

- Moduli 14, 16 + migrazione localStorage→DB (`importLocalIfDbEmpty`)
- Hook magazzino/contabilità/incassi su Supabase

---

## Fase 4 — Operativo & consegne ✅

### Implementato (agg. modulo 23)
- Worker SQL `claim_notifiche_outbox_batch` + Edge `notifiche-outbox-processor`
- Admin → Coda notifiche (`/admin/notifiche-outbox`)
- RPC `delivery_update_stato_consegna` + sync `stato_delivery`
- Vista rider PWA `/operative/rider`
- Fidelity cliente: match anche per email anagrafica
- **Notifiche ordine web**: `webOrderNotifications.js` (RPC + fallback webhook)
- **Fidelity cliente**: dashboard e profilo con saldo punti / movimenti
- **Report**: macro-categorie (pizze/fritti/dolci/bibite) + CSV esteso
- Delivery dashboard + RPC `delivery_mark_consegnato` (modulo 11, schema esistente)

### Fuori scope automatico (adapter da completare)
- Implementazione SMTP / SMS / WhatsApp in `supabase/functions/_shared/notifications/adapters/`
- Vedi `docs/NOTIFICHE_INTEGRAZIONE.md`
- Slot/capacity E2E con blocco slot pieni in vetrina

---

## Fase 5 — Piattaforma enterprise ✅ (core)

### Implementato
- **Modulo 22**: `admin.sa_catalog_snapshot` + sync Piani/Servizi SA
- **Offline cassa**: retry con backoff (`offlineRetryDelayMs`) + errori in banner Cassa
- **Fiscal**: RPC `fiscal_outbox_export_pending_json` + export JSON in monitor

### Ancora manuale / roadmap
- Billing Stripe abbonamenti tenant (produzione)
- Adapter vendor RT/SDI reale
- API pubbliche OAuth

---

## Ordine di esecuzione (completato)

1. Fase 1 → 2 → 3 → 4 → 5 (incrementale)

---

*Ultima revisione: 2026-06-02*
