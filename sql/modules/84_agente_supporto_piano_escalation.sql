-- Modulo 84 — Agente supporto consapevole del piano + escalation automatica
--
-- Origine: handoff sessione Claude mobile (mod 59), riscritto per lo schema reale
-- (admin.tenants invece di public.tenants, public.utenti_ruoli invece di
-- public.profiles.is_superadmin — vedi note in 76_tenant_documenti_firma.sql).
-- Da applicare DOPO il modulo 83. Additivo, idempotente, nessun DROP/DELETE.
--
-- ATTENZIONE — verificato il 2026-08-26: admin.tenants ha una colonna `piano` (text,
-- default 'free'), NON i valori 'base'/'standard'/'full' assunti sotto in piani_riferimento.chiave.
-- Prima di attivare l'agente, allineare le chiavi reali dei piani (chiedere a Nicolò quali
-- valori usa oggi admin.tenants.piano, o migrare i tenant esistenti ai nuovi valori) —
-- altrimenti la logica di suggerisci_upgrade in agente-chat.ts non troverà mai corrispondenza.

-- ---------------------------------------------------------
-- 1) Piani di riferimento (fonte unica di verità su nome/prezzo/ordine)
-- ---------------------------------------------------------
create table if not exists public.piani_riferimento (
  chiave text primary key,        -- 'base' | 'standard' | 'full' — DA ALLINEARE a admin.tenants.piano reale
  nome text not null,
  prezzo_mensile numeric(10,2),   -- IVA esclusa
  ordine integer not null,        -- 1 = più basso, cresce con il livello
  descrizione_breve text
);

alter table public.piani_riferimento enable row level security;

-- Lettura pubblica (serve anche al sito prezzi), scrittura solo superadmin
create policy piani_riferimento_public_select
  on public.piani_riferimento for select using (true);

create policy piani_riferimento_superadmin_write
  on public.piani_riferimento
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

insert into public.piani_riferimento (chiave, nome, prezzo_mensile, ordine, descrizione_breve) values
('base', 'Base', 29.00, 1, 'Cassa e comanda per una singola sede'),
('standard', 'Standard', 59.00, 2, 'Aggiunge ordini online, delivery e fidelity'),
('full', 'Full', 99.00, 3, 'Aggiunge magazzino, contabilità e multi-sede')
on conflict (chiave) do nothing;

-- ---------------------------------------------------------
-- 2) Catalogo moduli/funzioni — piano minimo richiesto e stato di sviluppo
-- ---------------------------------------------------------
create table if not exists public.moduli_catalogo (
  chiave text primary key,             -- es. 'cassa', 'delivery', 'magazzino'
  nome text not null,
  descrizione_supporto text not null,  -- guida operativa che l'agente usa per rispondere
  piano_minimo text not null references public.piani_riferimento(chiave),
  sviluppato boolean not null default true, -- false = non ancora esistente nel prodotto
  note text
);

comment on table public.moduli_catalogo is
  'Catalogo dei moduli/funzioni di PizzaManager: piano minimo richiesto e se sono realmente sviluppati. Usato dall''agente di supporto per capire cosa può spiegare, cosa richiede upgrade, cosa va segnalato come non disponibile.';

alter table public.moduli_catalogo enable row level security;

create policy moduli_catalogo_public_select
  on public.moduli_catalogo for select using (true);

create policy moduli_catalogo_superadmin_write
  on public.moduli_catalogo
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));

insert into public.moduli_catalogo (chiave, nome, descrizione_supporto, piano_minimo, sviluppato) values
('cassa', 'Cassa', 'Gestione incassi, chiusura cassa, scontrini. Disponibile da tastiera o tablet in sala.', 'base', true),
('comanda', 'Comanda', 'Invio ordini diretto in cucina, sostituisce i bigliettini cartacei.', 'base', true),
('ordini_online', 'Ordini Online', 'Vetrina pubblica per ordinazione dei clienti finali, integrata con cassa e cucina.', 'standard', true),
('delivery', 'Delivery e Rider', 'Assegnazione automatica rider, tracciamento consegna, notifiche push al cliente.', 'standard', true),
('fidelity', 'Fidelity', 'Programma fedeltà clienti, punti e premi collegati agli ordini.', 'standard', true),
('magazzino', 'Magazzino', 'Inventario valorizzato a costo medio ponderato, gestione scorte.', 'full', true),
('contabilita', 'Contabilità', 'Quadro base di incassi e costi, riepiloghi periodici.', 'full', true),
('multi_sede', 'Multi-sede', 'Gestione centralizzata di più locali dello stesso gruppo.', 'full', true)
on conflict (chiave) do nothing;

-- Esempio di funzione NON ancora sviluppata (da sostituire con le voci reali
-- della roadmap: questa riga serve solo a far funzionare fin da subito il
-- percorso "segnala come non disponibile" dell'agente).
insert into public.moduli_catalogo (chiave, nome, descrizione_supporto, piano_minimo, sviluppato, note) values
('prenotazioni_tavoli', 'Prenotazioni Tavoli', 'Gestione prenotazioni con conferma automatica.', 'full', false, 'ESEMPIO — sostituire con le reali voci di roadmap non ancora sviluppate.')
on conflict (chiave) do nothing;

-- ---------------------------------------------------------
-- 3) Richieste di funzionalità non disponibili (escalation via email)
-- ---------------------------------------------------------
create table if not exists public.richieste_funzionalita_non_disponibili (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references admin.tenants(id) on delete set null,
  sessione_id text not null,
  riepilogo text not null,          -- sintesi generata dall'agente di cosa serve al cliente
  trascrizione jsonb,                -- copia dei messaggi della chat al momento della segnalazione
  email_inviata boolean not null default false,
  email_dettaglio text,              -- esito/errore dell'invio email
  created_at timestamptz not null default now()
);

comment on table public.richieste_funzionalita_non_disponibili is
  'Richieste di funzionalità non sviluppate, intercettate dall''agente di supporto e girate via email a info@pizzamanager.it.';

create index if not exists richieste_funzionalita_tenant_idx
  on public.richieste_funzionalita_non_disponibili (tenant_id, created_at desc);

alter table public.richieste_funzionalita_non_disponibili enable row level security;

create policy richieste_funzionalita_superadmin_all
  on public.richieste_funzionalita_non_disponibili
  for all
  using (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')))
  with check (exists (select 1 from public.utenti_ruoli ur where ur.user_id = (select auth.uid())
    and coalesce(ur.attivo, true) = true and lower(trim(coalesce(ur.ruolo, ''))) in ('superadmin', 'super_admin')));
