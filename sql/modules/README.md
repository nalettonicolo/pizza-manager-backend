# sql/modules — patch incrementali

Patch **idempotenti** da applicare su DB già in produzione/staging.

## Stato (2026-08-06)

| Range | Stato |
|-------|--------|
| `01`–`17`, `39`–`41` | Consolidati in `schema_completo_pizzamanager.sql` — file rimossi |
| `18`–`38` | Attivi: già applicati su remoto; elenco in `sql/sql_upgrade.sql` |

## Nuova installazione

Usare **`sql/schema_completo_pizzamanager.sql`** + poi applicare i moduli `18`–`38` ancora presenti in questa cartella.

## Applicazione singola patch

```bash
npm run sql:apply -- sql/modules/NN_descrizione.sql
```

Dopo consolidamento in `schema_completo`, rimuovere il file modulo e aggiornare `sql_upgrade.sql`.
