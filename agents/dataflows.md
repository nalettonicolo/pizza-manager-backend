# Agente: Dataflows & monitoraggio DB (PizzaManager)

Mappa **flussi applicativi → oggetti PostgreSQL/Supabase** per revisioni incrociate con `@agents/database.md` e `@agents/security.md`. Non sostituisce le migration: la fonte DDL resta `sql/sql_upgrade.sql` e `sql/schema_completo_pizzamanager.sql`.

## Come usarlo in Cursor

- Per **schema/RLS**: `@agents/database.md` + questo file.
- Per **minacce e policy**: `@agents/security.md` + questo file.
- Per **feature contabilità semplice**: voci sotto *Admin · incassi*.
- Con **MCP Supabase** abilitato in Cursor (vedi `agents/README.md`): chiedi verifiche incrociando le tabelle elencate qui con query/tool MCP, sempre in **read-only** e su ambiente non produzione se possibile.

## Flussi principali

### Ordini cassa / righe

| Flusso | UI / API | Tabelle / viste | Note sicurezza |
|--------|----------|-----------------|----------------|
| Creazione ordine | Cassa, `create_order_with_items` RPC | `core.ordini`, `core.riga_ordine` | Tenant da sessione; RPC `SECURITY DEFINER` |
| Lettura / update stato | Vista `public."Ordine"` (INSTEAD OF) | `core.ordini` | RLS / filtro `utenti_ruoli` + `clienti` sulla vista |
| Report vendite / macro categorie | Admin Report, Gestione incassi | `public."Ordine"`, `RigaOrdine` / core, `Prodotto`, categorie | Solo dati tenant; niente bypass client |

### Contabilità semplificata (`contabilita_semplice`)

| Flusso | UI | Tabelle | RLS |
|--------|-----|---------|-----|
| Incassi manuali | `/admin/contabilita/incassi` | `public.contabilita_movimenti` | Policy staff tenant (`utenti_ruoli`) |
| Conteggi pizze/fritti/dolci/bibite | Stessa pagina (periodo) | Lettura ordini + righe + prodotti + categorie | Come report (autenticato tenant) |

### Contabilità completa (`contabilita_locale`)

| Flusso | UI | Persistenza |
|--------|-----|-------------|
| Fatture, food cost, spese | Sotto `/admin/contabilita/*` | prevalentemente `useTenantLocalJson` (browser) salvo dove già migrato |

### Fidelity

| Flusso | Tabelle | RLS |
|--------|---------|-----|
| Punti / movimenti | `public.fidelity_saldi`, `public.fidelity_movimenti` | Staff tenant |

### Fiscal / pay-by-link (dopo sql_upgrade)

| Flusso | Tabelle |
|--------|---------|
| Coda invii / intent pagamento | `public.fiscal_outbox`, `public.payment_link_intents` |

### Rider / delivery enterprise

| Flusso | Schema | Tabelle chiave |
|--------|--------|----------------|
| Percorsi, eventi | `core` | `rider`, `turno_rider`, `consegna_percorso`, `ordine_consegna_evento`, … |

## Smoke check post-migration (manuale)

1. **Inventario + RLS (read-only):** `sql/scripts/verify_database_inventory_readonly.sql` (vedi `sql/scripts/README_VERIFY_RLS.md`).
2. **RLS cross-tenant**: query come utente test per tenant A → nessun dato tenant B (`README_VERIFY_RLS.md`).
3. **contabilita_movimenti**: `select` con JWT admin tenant → ok; `anon` → negato.
4. **Vista Ordine**: update campo consentito → propagato a `core.ordini`.

## Collegamento agenti

- **database.md**: definisce *come* scrivere SQL (idempotenza, RLS, RPC).
- **security.md**: *cosa* verificare (leak, IDOR, service role).
- **dataflows.md** (questo file): *dove* guardare nel DB per un dato flusso prodotto.
