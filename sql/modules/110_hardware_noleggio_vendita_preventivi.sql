-- Modulo 110 — Hardware: prezzo di vendita oltre al noleggio + nuovo tipo documento "preventivo"
--
-- Richiesta esplicita dell'utente: il catalogo attrezzature (Hardware) deve avere prezzi STANDARD
-- non modificabili ogni volta in fase di preventivo — un prezzo per il noleggio operativo (già
-- esistente, canone_noleggio_mensile) e uno per la vendita (nuovo, prezzo_vendita), da scegliere
-- al momento di aggiungere il prodotto al preventivo/contratto invece di digitare un importo a
-- mano. Inoltre: "ogni tenant può richiedere più preventivi" — nuovo tipo_documento
-- 'preventivo_commerciale' (bozza salvabile e listabile, mai firmata, distinta dal
-- 'contratto_commerciale' che invece richiede sempre firma).

alter table public.attrezzature_catalogo add column if not exists prezzo_vendita numeric;
comment on column public.attrezzature_catalogo.prezzo_vendita is
  'Prezzo di vendita una tantum (IVA esclusa), alternativo al noleggio mensile — scelto per riga in tenant_noleggi.tipo.';

alter table public.tenant_noleggi add column if not exists tipo text not null default 'noleggio';
alter table public.tenant_noleggi drop constraint if exists tenant_noleggi_tipo_check;
alter table public.tenant_noleggi add constraint tenant_noleggi_tipo_check
  check (tipo in ('noleggio', 'vendita'));

alter table public.tenant_noleggi add column if not exists prezzo_vendita_totale numeric;
comment on column public.tenant_noleggi.prezzo_vendita_totale is
  'Valorizzato solo per righe tipo=vendita: prezzo una tantum totale (prezzo_vendita di catalogo * quantità). Per tipo=noleggio resta null, si usa canone_mensile.';

alter table public.tenant_documenti drop constraint if exists tenant_documenti_tipo_documento_check;
alter table public.tenant_documenti add constraint tenant_documenti_tipo_documento_check
  check (tipo_documento in (
    'termini_servizio', 'privacy_policy', 'contratto_abbonamento', 'dpa', 'addendum_noleggio',
    'contratto_commerciale', 'preventivo_commerciale'
  ));
