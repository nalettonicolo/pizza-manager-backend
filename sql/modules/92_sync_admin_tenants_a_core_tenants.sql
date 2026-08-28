-- Modulo 92: sincronizza admin.tenants -> core.tenants (trigger + backfill)
--
-- Bug strutturale scoperto creando i tenant demo: admin.tenants è la fonte di verità anagrafica
-- scritta dalla UI Super Admin (Tenants.jsx -> createTenant/updateTenant), ma tutte le tabelle
-- operative (core.categorie, core.ingredienti, core.prodotti, core.ordini, core.punti_vendita,
-- core.rider, core.sale, core.tavoli, core.subscriptions, core.users, ...) hanno una foreign key
-- su core.tenants — mai sincronizzata con admin.tenants. Ogni tenant creato dalla UI restava
-- quindi "orfano" lato core: impossibile creare categorie/ingredienti/pizze/ordini per quel
-- tenant finché qualcuno non inseriva a mano la riga in core.tenants.
--
-- Non era un problema isolato ai tenant demo: verificato che anche un tenant reale con dominio
-- pubblico già configurato (mariorossipizza) ne era colpito. Solo un tenant storico
-- ("PizzaManager.it") aveva la riga in core.tenants.
--
-- Fix in due parti:
-- 1) trigger AFTER INSERT OR UPDATE su admin.tenants che allinea (upsert) core.tenants a ogni
--    scrittura futura — coerente con l'automazione già introdotta per il menu base dei nuovi
--    tenant (src/features/admin/services/menuBaseSeed.js).
-- 2) backfill una tantum per i tenant già esistenti senza riga in core.tenants.
--
-- Note sul cast piano: core.piano_saas è un enum con solo FREE/PRO/ENTERPRISE, mentre
-- admin.tenants.piano è testo libero e include anche "TRIAL" (frontend: PIANO_OPTIONS in
-- Tenants.jsx, "Prova (14 gg) — bundle come Pro"). TRIAL e qualunque altro valore fuori
-- dall'enum mappano su PRO, non su FREE, per restare coerenti con quel bundle.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nome migrazione: sync_admin_tenants_to_core_tenants).
-- Verificato dopo l'applicazione: tutti i tenant esistenti (inclusi i 4 demo e mariorossipizza)
-- risultano con riga corrispondente in core.tenants.

create or replace function admin.sync_tenant_to_core()
returns trigger
language plpgsql
security definer
set search_path = admin, core, public
as $$
declare
  v_piano core.piano_saas;
begin
  begin
    v_piano := nullif(upper(trim(coalesce(new.piano, ''))), '')::core.piano_saas;
  exception when invalid_text_representation then
    v_piano := 'PRO'::core.piano_saas;
  end;
  if v_piano is null then
    v_piano := 'FREE'::core.piano_saas;
  end if;

  insert into core.tenants (
    id, nome, slug, piano, attivo, indirizzo, telefono, email, lat, lng,
    orari_settimana, parametri_operativi, partita_iva, email_fatturazione, pec,
    codice_univoco_sdi, addebito_automatico_mensile, data_attivazione_abbonamento,
    sconto_percentuale, deleted_at, created_at, updated_at
  )
  values (
    new.id, new.nome, new.slug, v_piano, coalesce(new.attivo, true), new.indirizzo,
    new.telefono, new.email, new.lat, new.lng,
    coalesce(new.orari_settimana, '[]'::jsonb), coalesce(new.parametri_operativi, '{}'::jsonb),
    new.partita_iva, new.email_fatturazione, new.pec, new.codice_univoco_sdi,
    coalesce(new.addebito_automatico_mensile, false), new.data_attivazione_abbonamento,
    coalesce(new.sconto_percentuale, 0), new.deleted_at,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  )
  on conflict (id) do update set
    nome = excluded.nome,
    slug = excluded.slug,
    piano = excluded.piano,
    attivo = excluded.attivo,
    indirizzo = excluded.indirizzo,
    telefono = excluded.telefono,
    email = excluded.email,
    lat = excluded.lat,
    lng = excluded.lng,
    orari_settimana = excluded.orari_settimana,
    parametri_operativi = excluded.parametri_operativi,
    partita_iva = excluded.partita_iva,
    email_fatturazione = excluded.email_fatturazione,
    pec = excluded.pec,
    codice_univoco_sdi = excluded.codice_univoco_sdi,
    addebito_automatico_mensile = excluded.addebito_automatico_mensile,
    data_attivazione_abbonamento = excluded.data_attivazione_abbonamento,
    sconto_percentuale = excluded.sconto_percentuale,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists trg_sync_tenant_to_core on admin.tenants;
create trigger trg_sync_tenant_to_core
after insert or update on admin.tenants
for each row execute function admin.sync_tenant_to_core();

-- Backfill: allinea subito i tenant già esistenti che non hanno mai avuto la riga in core.tenants.
insert into core.tenants (
  id, nome, slug, piano, attivo, indirizzo, telefono, email, lat, lng,
  orari_settimana, parametri_operativi, partita_iva, email_fatturazione, pec,
  codice_univoco_sdi, addebito_automatico_mensile, data_attivazione_abbonamento,
  sconto_percentuale, deleted_at, created_at, updated_at
)
select
  a.id, a.nome, a.slug,
  coalesce(
    (case when upper(trim(coalesce(a.piano, ''))) in ('FREE','PRO','ENTERPRISE')
          then upper(trim(a.piano))::core.piano_saas
          else 'PRO'::core.piano_saas end),
    'FREE'::core.piano_saas
  ),
  coalesce(a.attivo, true), a.indirizzo, a.telefono, a.email, a.lat, a.lng,
  coalesce(a.orari_settimana, '[]'::jsonb), coalesce(a.parametri_operativi, '{}'::jsonb),
  a.partita_iva, a.email_fatturazione, a.pec, a.codice_univoco_sdi,
  coalesce(a.addebito_automatico_mensile, false), a.data_attivazione_abbonamento,
  coalesce(a.sconto_percentuale, 0), a.deleted_at,
  coalesce(a.created_at, now()), coalesce(a.updated_at, now())
from admin.tenants a
where not exists (select 1 from core.tenants c where c.id = a.id)
on conflict (id) do nothing;
