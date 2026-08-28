-- Modulo 101 — RLS mancante su core.carrelli_sospesi (difesa in profondità)
--
-- Trovato in audit sistematico (stress test pre-produzione): core.carrelli_sospesi era l'UNICA
-- tabella con colonna tenant_id, tra tutte quelle di public e core, senza row level security
-- attiva. Verificato con cura prima di considerarlo sfruttabile (come da lezione già imparata in
-- sessione su un falso allarme simile con public.punti_vendita): NON lo è, perché
-- - non ha nessun grant diretto per i ruoli authenticated/anon (solo service_role e postgres);
-- - le uniche 3 funzioni che la espongono al client (upsert_carrello_sospeso,
--   get_carrello_sospeso_cliente, delete_carrello_sospeso) verificano già correttamente
--   auth.uid() più appartenenza al tenant (staff) o identità esatta del cliente prima di ogni
--   lettura/scrittura.
-- Applicata comunque per difesa in profondità: se in futuro un grant diretto venisse aggiunto per
-- errore (es. copiando un pattern da un'altra tabella), l'RLS resterebbe comunque a proteggere
-- l'isolamento tra tenant.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nome migrazione: rls_carrelli_sospesi).
alter table core.carrelli_sospesi enable row level security;

create policy carrelli_sospesi_tenant_staff_or_cliente
  on core.carrelli_sospesi
  for all
  using (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = auth.uid() and ur.tenant_id = carrelli_sospesi.tenant_id and coalesce(ur.attivo, true) = true
    )
    or exists (
      select 1 from public.clienti c
      where c.id = auth.uid() and c.id = carrelli_sospesi.cliente_id and c.tenant_id = carrelli_sospesi.tenant_id
    )
  )
  with check (
    exists (
      select 1 from public.utenti_ruoli ur
      where ur.user_id = auth.uid() and ur.tenant_id = carrelli_sospesi.tenant_id and coalesce(ur.attivo, true) = true
    )
    or exists (
      select 1 from public.clienti c
      where c.id = auth.uid() and c.id = carrelli_sospesi.cliente_id and c.tenant_id = carrelli_sospesi.tenant_id
    )
  );
