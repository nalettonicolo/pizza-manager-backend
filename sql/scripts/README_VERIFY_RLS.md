# Verifica RLS e isolamento tenant (staging / produzione)

## Scopo

Fornire **linee guida** per verifiche manuali o script SQL eseguiti con due sessioni (`auth.uid()` diversi o JWT di test). Adattare nomi schema/tabella al proprio ambiente.

## Principi

1. **Mai** eseguire script di test su produzione senza finestra di manutenzione e backup.
2. Usare utenti reali di **due tenant** diversi creati ad hoc.
3. Documentare esito in ticket / Confluence.

## Esempi di query concettuali (Postgres / Supabase)

### A) Verifica che una policy blocchi il cross-tenant

Con sessione utente del **tenant A**, tentare `SELECT` su righe con `tenant_id` del **tenant B** sulla stessa tabella: deve restituire **0 righe** o errore secondo policy.

### B) RPC sensibili

Chiamare `replace_order_items` con `p_ordine_id` di un altro tenant senza permesso: deve fallire con `non_autorizzato` o equivalente.

### C) Ruolo anon

Verificare che `anon` possa solo leggere ciò che la policy `anon_select_*` consente (es. menu pubblico), e nulla su ordini.

## Automazione futura

- Integrare in CI **non** è banale (serve DB effimero + seed). Priorità: **script in staging** settimanale eseguito da pipeline con credenziali dedicate.
