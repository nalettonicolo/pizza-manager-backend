-- Modulo 108 — Nuovo tipo documento "contratto_commerciale" (contratto compilato da servizi/attrezzature reali)
--
-- Il "Contratto di Abbonamento" (contratto_abbonamento) resta un template ToS-style generico e
-- statico. Questo nuovo tipo è invece compilato DAVVERO con i servizi effettivamente selezionati
-- per il tenant (admin.tenants.parametri_operativi) e le attrezzature a noleggio attive
-- (tenant_noleggi) — richiesta esplicita dell'utente: "il contratto deve essere compilato in base
-- ai servizi o attrezzature che inserisco io in fase di contratto". Ogni rigenerazione crea una
-- nuova riga (mai un update di un contratto già firmato — la RLS lo impedisce comunque per gli
-- admin tenant), quindi ogni modifica ai servizi/attrezzature richiede una nuova firma.

alter table public.tenant_documenti drop constraint if exists tenant_documenti_tipo_documento_check;
alter table public.tenant_documenti add constraint tenant_documenti_tipo_documento_check
  check (tipo_documento in (
    'termini_servizio', 'privacy_policy', 'contratto_abbonamento', 'dpa', 'addendum_noleggio', 'contratto_commerciale'
  ));
