-- =============================================================================
-- Modulo 55 — Tabella stato checklist Chek-Sviluppi (Super Admin), condivisa tra ambienti
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 come
-- "superadmin_checklist_mese_progress" via MCP apply_migration.
-- =============================================================================
--
-- Contesto: lo stato "fatto/nota" di ogni voce della checklist mensile (Super Admin →
-- Chek-Sviluppi) viveva solo in localStorage del browser (chiave
-- pm_superadmin_checklist_modifiche_mese_v2_codici) — isolato per origine, quindi flaggare
-- una voce su produzione non la faceva comparire fatta in locale (localhost) e viceversa.
-- Nessun tenant coinvolto: è uno strumento interno di tracciamento sviluppo, non dati cliente.
--
-- RLS: solo superadmin (pm_auth_is_superadmin()) può leggere/scrivere — stesso helper già
-- usato da superadmin_create_oauth_client/superadmin_revoke_oauth_client.

CREATE TABLE public.superadmin_checklist_mese_progress (
  codice text PRIMARY KEY,
  done boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.superadmin_checklist_mese_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY superadmin_checklist_mese_progress_all
  ON public.superadmin_checklist_mese_progress
  FOR ALL
  TO authenticated
  USING (public.pm_auth_is_superadmin())
  WITH CHECK (public.pm_auth_is_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.superadmin_checklist_mese_progress TO authenticated;
