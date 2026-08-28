-- Modulo 87 — Fix architetturale: separare le policy "ALL" superadmin dal SELECT pubblico
--
-- Causa radice (continua da modulo 86): anche con il GRANT su tenant_admins, un SELECT
-- anonimo su una tabella con sia una policy "public_select" SIA una policy "superadmin
-- for all" fallisce comunque, perché Postgres valuta OGNI policy PERMISSIVE applicabile al
-- comando (qui: SELECT, coperto sia dalla policy dedicata sia da quella ALL) per combinarle
-- con OR — quindi deve comunque valutare "EXISTS (SELECT 1 FROM utenti_ruoli ...)" della
-- policy ALL, e utenti_ruoli NON deve essere leggibile da anon (contiene dati staff sensibili:
-- user_id/ruolo/tenant_id). Il fix corretto non è concedere altri GRANT a catena, ma separare
-- le policy: quelle di scrittura devono coprire SOLO insert/update/delete, mai select, così
-- un SELECT anonimo sulle tabelle a contenuto pubblico valuta solo la policy "public_select"
-- (nessun riferimento a utenti_ruoli) senza mai toccare la tabella ruoli.
--
-- Tocca le 5 tabelle con lettura pubblica dei moduli 79/80/84: faq_pubbliche, landing_pages,
-- blog_articoli, piani_riferimento, moduli_catalogo. Additivo/sostitutivo di sole policy,
-- nessun DROP di tabelle/dati.
--
-- Verificato via `set local role anon; select ...` sul remoto dopo l'apply: risolto per
-- tutte e 5 le tabelle, e confermato live nel sito (sezione FAQ della Landing carica
-- correttamente). Applicato al remoto (flfhrwzlrftuhkrfwzse) il 2026-08-26.

drop policy if exists faq_pubbliche_superadmin_write on public.faq_pubbliche;
create policy faq_pubbliche_superadmin_insert on public.faq_pubbliche
  for insert with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy faq_pubbliche_superadmin_update on public.faq_pubbliche
  for update using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy faq_pubbliche_superadmin_delete on public.faq_pubbliche
  for delete using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

drop policy if exists landing_pages_superadmin_all on public.landing_pages;
create policy landing_pages_superadmin_insert on public.landing_pages
  for insert with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy landing_pages_superadmin_update on public.landing_pages
  for update using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy landing_pages_superadmin_delete on public.landing_pages
  for delete using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

drop policy if exists blog_articoli_superadmin_all on public.blog_articoli;
create policy blog_articoli_superadmin_insert on public.blog_articoli
  for insert with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy blog_articoli_superadmin_update on public.blog_articoli
  for update using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy blog_articoli_superadmin_delete on public.blog_articoli
  for delete using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

drop policy if exists piani_riferimento_superadmin_write on public.piani_riferimento;
create policy piani_riferimento_superadmin_insert on public.piani_riferimento
  for insert with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy piani_riferimento_superadmin_update on public.piani_riferimento
  for update using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy piani_riferimento_superadmin_delete on public.piani_riferimento
  for delete using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

drop policy if exists moduli_catalogo_superadmin_write on public.moduli_catalogo;
create policy moduli_catalogo_superadmin_insert on public.moduli_catalogo
  for insert with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy moduli_catalogo_superadmin_update on public.moduli_catalogo
  for update using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
create policy moduli_catalogo_superadmin_delete on public.moduli_catalogo
  for delete using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
