-- =============================================================================
-- Modulo 56 — Fix FK verso core.users (tabella legacy mai popolata, 0 righe)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 come
-- "fix_audit_logs_user_id_fkey_to_auth_users" e "fix_rider_staff_user_id_fkey_to_auth_users".
-- =============================================================================
--
-- Bug critico trovato in backtest live: "Accetta" su un ordine web falliva SEMPRE con
-- "insert or update on table audit_logs violates foreign key constraint
-- audit_logs_user_id_fkey" — bloccando l'accettazione ordini e qualunque transizione di
-- stato (stato/stato_delivery/rider_id) fatta da un utente autenticato.
--
-- Causa: core.audit_logs.user_id referenziava core.users(id) — tabella legacy MAI popolata
-- (0 righe, verificato) — mentre il trigger core.trg_audit_ordini_stato() inserisce sempre
-- auth.uid() (l'id reale Supabase Auth). I due ID space non coincidono → FK sempre violata,
-- ogni singolo audit falliva e faceva rollback anche dell'UPDATE che lo ha innescato
-- (core.audit_logs risultava con 0 righe totali: il trigger non ha mai scritto un audit con
-- successo da quando esiste).
--
-- Stesso pattern trovato (e corretto) anche su core.rider.staff_user_id, non ancora esploso
-- in produzione solo perché nessun codice imposta oggi quella colonna — core.rider.auth_user_id
-- referenziava già correttamente auth.users(id), confermando che quello è il pattern giusto.
--
-- Fix: entrambe le FK ora puntano ad auth.users(id), il sistema di identità realmente in uso.

ALTER TABLE core.audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
ALTER TABLE core.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE core.rider DROP CONSTRAINT rider_staff_user_id_fkey;
ALTER TABLE core.rider
  ADD CONSTRAINT rider_staff_user_id_fkey
  FOREIGN KEY (staff_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
