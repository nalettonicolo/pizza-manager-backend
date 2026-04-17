# AI Team — PizzaManager (Cursor)

Questa cartella contiene i **profili agente** da usare come contesto in chat, insieme alla regola globale in `.cursor/rules/global.mdc`.

## Prerequisito

Il progetto è **già in sviluppo avanzato**: non usare questi file per “ricreare da zero” l’app; servono a **governare** feature, refactor e sicurezza.

## Uso in Cursor

1. Apri la chat (o Composer).
2. Allega il profilo con `@`, ad esempio: `@agents/product.md`.
3. Scrivi il task (una feature alla volta).
4. Ciclo tipico: **product** → **architecture** → **database** (se serve) → **code** / **ui** → **copywriter** (stringhe visibili: pubblico, admin tenant, superadmin) → **test** → **security** → **supervisor**.

## Collegare Supabase (MCP) per monitoraggio da Cursor

Obiettivo: far usare all’assistente i **tool MCP** di Supabase (liste tabelle, `execute_sql`, log, advisor, ecc.) così richieste tipo “verifica RLS” o “elenco policy su X” possono appoggiarsi al DB reale, **sotto la tua approvazione** (accetta ogni chiamata tool in Cursor).

1. **Documentazione ufficiale:** [Model context protocol (MCP) — Supabase](https://supabase.com/docs/guides/getting-started/mcp) (rischi, `read_only`, `project_ref`, gruppi `features`).
2. **Project ref:** Dashboard Supabase → **Settings → General** → *Reference ID*.
3. **Configurazione in Cursor:** **Settings → Cursor Settings → Tools & MCP** → aggiungi server. Puoi usare l’URL hosted con parametri dalla doc Supabase, oppure copiare **`.cursor/mcp.json.example`** in **`.cursor/mcp.json`**, sostituire `SOSTITUISCI_PROJECT_REF` e lasciare **`read_only=true`** per diagnostica.
4. **`.cursor/mcp.json` è in `.gitignore`** — non committare segreti o URL con credenziali.
5. **OAuth / login:** al primo utilizzo Cursor può aprire il browser per autorizzare l’accesso all’organizzazione Supabase.

**Workflow con `@agents/`:** in chat allega ad esempio `@agents/database.md` `@agents/dataflows.md` `@agents/security.md` e chiedi di usare i tool MCP (es. “query in sola lettura su …”). Il modello propone le azioni; **tu** confermi in UI.

**Avvertenze:** preferire **progetto di sviluppo** o **branch**, non produzione con dati sensibili; MCP solo per **uso interno** sviluppo, non per clienti finali.

## File

| File | Ruolo |
|------|--------|
| `supervisor.md` | Validazione finale (APPROVATO / BLOCCATO) |
| `architecture.md` | Confini e stack |
| `product.md` | Flussi pizzeria |
| `database.md` | SQL, RLS, RPC |
| `code.md` | React + integrazione |
| `ui.md` | UX / layout |
| `copywriter.md` | Testi UI professionali: vetrina, **admin tenant**, **superadmin** (microcopy, guide, senza gergo da repo) |
| `test.md` | QA |
| `security.md` | Threat + mitigazioni |
| `dataflows.md` | Flussi app ↔ tabelle Supabase (monitoraggio con database + security) |

Riferimento metodologico: guida interna “Setup AI Team” (adattata al repo corrente).

Documenti di coordinamento e sicurezza (repo):

- `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` — epic, ordine di lavoro, supervisore.
- `docs/MIGRAZIONE_MYSQL_E_BACKUP.md` — roadmap stacco Supabase → MySQL e backup.
- `docs/SICUREZZA_HARDENING.md` — blindatura, crittografia, checklist.
- `sql/scripts/README_VERIFY_RLS.md` — verifiche RLS in staging.
