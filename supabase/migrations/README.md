# Migrazioni Supabase (versionate)

Fonte operativa quotidiana resta `sql/modules/NN_*.sql` + `npm run sql:apply`.

Questa cartella avvia il **mirror versionato** per allineare staging/produzione:

| File | Equivalente |
|------|-------------|
| `20260802180000_go_live_checklist.sql` | `sql/modules/29_go_live_checklist.sql` |
| `20260802180100_support_presence_tenant_bind.sql` | `sql/modules/30_…` |
| `20260802180200_security_definer_search_path.sql` | `sql/modules/31_…` |

## Regola

1. Scrivere prima il modulo in `sql/modules/`
2. Applicare con `npm run sql:apply`
3. Copiare (o generare) lo stesso SQL in `supabase/migrations/YYYYMMDDHHMMSS_descrizione.sql`
4. Elencare in `sql/sql_upgrade.sql`

Non usare `supabase db reset` su produzione. Gate: vedi `docs/PROGRAMMA_AFFIDABILITA.md`.
