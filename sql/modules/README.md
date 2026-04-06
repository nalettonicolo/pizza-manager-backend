# Moduli SQL (storico manuale)

Esegui **in ordine numerico** su Supabase SQL Editor (o equivalente) se il database non ha ancora questi oggetti.

| File | Contenuto |
|------|-----------|
| `01_fidelity_tenant.sql` | Tabelle fidelity, RLS, default `parametri_operativi` tenant |
| `02_punti_vendita_core.sql` | `core.punti_vendita`, vista `public.punti_vendita` (base) |
| `03_ordini_extensions.sql` | Colonne `core.ordini` (coordinate, pagamento misto, PV, …) |
| `04_ordine_view_trigger.sql` | Vista `public."Ordine"`, trigger INSTEAD OF UPDATE |
| `05_pm_point_create_order.sql` | `pm_point_in_ring`, `create_order_with_items` |
| `06_contabilita_movimenti.sql` | Tabella incassi manuali + RLS |
| `07_magazzino_movimenti.sql` | Tabella movimenti magazzino + RLS |
| `08_seed_pv_default.sql` | Seed “Sede principale” per tenant senza PV |
| `09_legal_public_resolve.sql` | Colonne legal/admin tenant, `resolve_public_tenant_by_domain` |
| `10_punti_vendita_lat_lng_view.sql` | `lat`/`lng` su PV e vista aggiornata |

Esiste anche lo schema di riferimento in `sql/schema_completo_pizzamanager.sql` e le migration in `supabase/migrations/`.

Le **nuove** modifiche vanno aggiunte in `sql/sql_upgrade.sql` e/o in una migration datata sotto `supabase/migrations/`.
