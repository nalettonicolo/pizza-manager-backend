# AI Team — PizzaManager (Cursor)

Questa cartella contiene i **profili agente** da usare come contesto in chat, insieme alla regola globale in `.cursor/rules/global.mdc`.

## Prerequisito

Il progetto è **già in sviluppo avanzato**: non usare questi file per “ricreare da zero” l’app; servono a **governare** feature, refactor e sicurezza.

## Uso in Cursor

1. Apri la chat (o Composer).
2. Allega il profilo con `@`, ad esempio: `@agents/product.md`.
3. Scrivi il task (una feature alla volta).
4. Ciclo tipico: **product** → **architecture** → **database** (se serve) → **code** / **ui** → **copywriter** (se servono testi pubblici) → **test** → **security** → **supervisor**.

## File

| File | Ruolo |
|------|--------|
| `supervisor.md` | Validazione finale (APPROVATO / BLOCCATO) |
| `architecture.md` | Confini e stack |
| `product.md` | Flussi pizzeria |
| `database.md` | SQL, RLS, RPC |
| `code.md` | React + integrazione |
| `ui.md` | UX / layout |
| `copywriter.md` | Testi pubblici professionali (marketing, microcopy, landing) |
| `test.md` | QA |
| `security.md` | Threat + mitigazioni |

Riferimento metodologico: guida interna “Setup AI Team” (adattata al repo corrente).

Documenti di coordinamento e sicurezza (repo):

- `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` — epic, ordine di lavoro, supervisore.
- `docs/MIGRAZIONE_MYSQL_E_BACKUP.md` — roadmap stacco Supabase → MySQL e backup.
- `docs/SICUREZZA_HARDENING.md` — blindatura, crittografia, checklist.
- `sql/scripts/README_VERIFY_RLS.md` — verifiche RLS in staging.
