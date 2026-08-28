-- Modulo 80 — Area Marketing: contenuti (blog + landing page)
--
-- Origine: handoff sessione Claude mobile (mod 55), riscritto per lo schema reale
-- (public.utenti_ruoli invece di public.profiles.is_superadmin — vedi note in
-- 76_tenant_documenti_firma.sql). Indipendente da 76/77, si appoggia allo stesso
-- pattern RLS di 78/79. Additivo, idempotente, nessun DROP/DELETE.

-- ---------------------------------------------------------
-- 1) Articoli blog
-- ---------------------------------------------------------
create table if not exists public.blog_articoli (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,             -- es. "food-cost-pizza-come-calcolarlo"
  titolo text not null,
  estratto text,                          -- riassunto breve per anteprime/liste
  contenuto text not null,                -- markdown
  categoria text default 'generale',      -- es. food_cost, gestione, delivery, impasti
  meta_description text,
  autore text default 'PizzaManager',
  pubblicato boolean not null default false,
  data_pubblicazione date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blog_articoli is
  'Articoli blog del sito pubblico pizzamanager.it: contenuti SEO/AI non-branded (es. food cost, gestione impasti).';

create index if not exists blog_articoli_pubblicati_idx
  on public.blog_articoli (data_pubblicazione desc) where pubblicato = true;

alter table public.blog_articoli enable row level security;

create policy blog_articoli_public_select
  on public.blog_articoli
  for select
  using (pubblicato = true);

create policy blog_articoli_superadmin_all
  on public.blog_articoli
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 2) Landing page (moduli e confronti concorrenti)
-- ---------------------------------------------------------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,              -- es. "vs-trancio", "modulo-delivery"
  tipo text not null check (tipo in ('modulo', 'confronto', 'generico')),
  titolo text not null,
  sottotitolo text,
  contenuto text not null,                -- markdown, può includere sezioni tabellari
  meta_description text,
  concorrente_rif uuid references public.concorrenti(id) on delete set null, -- solo per tipo='confronto'
  pubblicata boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.landing_pages is
  'Landing page del sito pubblico: una per modulo (ordini online, cassa, ...) e una per confronto concorrente (vs Trancio, vs Cassa in Cloud...).';

create index if not exists landing_pages_tipo_idx on public.landing_pages (tipo) where pubblicata = true;

alter table public.landing_pages enable row level security;

create policy landing_pages_public_select
  on public.landing_pages
  for select
  using (pubblicata = true);

create policy landing_pages_superadmin_all
  on public.landing_pages
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

-- ---------------------------------------------------------
-- 3) Scaffold iniziale — righe in bozza da completare (non pubblicate)
-- ---------------------------------------------------------
insert into public.landing_pages (slug, tipo, titolo, sottotitolo, contenuto, pubblicata) values
('modulo-ordini-online', 'modulo', 'Ordini Online per Pizzerie', 'Vetrina pubblica per ordinazione, integrata con cassa e cucina', '[da scrivere]', false),
('modulo-cassa', 'modulo', 'Cassa per Pizzerie', 'Gestione incassi rapida, pensata per il ritmo di una pizzeria', '[da scrivere]', false),
('modulo-comanda', 'modulo', 'Comanda Digitale per Pizzerie', 'Zero bigliettini cartacei, comande dirette in cucina', '[da scrivere]', false),
('modulo-delivery', 'modulo', 'Gestione Delivery e Rider', 'Assegnazione automatica rider, tracciamento e notifiche cliente', '[da scrivere]', false),
('modulo-magazzino', 'modulo', 'Magazzino e Inventario per Pizzerie', 'Inventario valorizzato a costo medio ponderato', '[da scrivere]', false),
('modulo-fidelity', 'modulo', 'Programma Fidelity per Pizzerie', 'Fidelizzazione clienti integrata con ordini e cassa', '[da scrivere]', false),
('modulo-contabilita', 'modulo', 'Contabilità di Base per Pizzerie', 'Un quadro chiaro di incassi e costi senza fogli Excel', '[da scrivere]', false),
('modulo-multisede', 'modulo', 'Gestione Multi-Sede per Catene di Pizzerie', 'Controllo centralizzato di più locali', '[da scrivere]', false)
on conflict (slug) do nothing;

-- Landing di confronto collegata al concorrente già censito nel modulo 78
insert into public.landing_pages (slug, tipo, titolo, sottotitolo, contenuto, concorrente_rif, pubblicata)
select 'vs-trancio', 'confronto', 'PizzaManager vs Trancio', 'Qual è la scelta giusta per la tua pizzeria?', '[da scrivere: confronto funzionalità, in particolare cassa/magazzino/contabilità/multi-sede assenti in Trancio]', c.id, false
from public.concorrenti c where c.nome = 'Trancio' limit 1
on conflict (slug) do nothing;

insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'seo',
  'Scaffold landing page creato, contenuti da scrivere',
  'Righe create in landing_pages per gli 8 moduli e per il confronto vs Trancio, tutte non pubblicate (contenuto placeholder). Priorità: scrivere prima le landing di confronto (alta intenzione d''acquisto) e il modulo delivery/ordini online (probabile volume di ricerca maggiore).',
  'alta', 'da_valutare'
);
