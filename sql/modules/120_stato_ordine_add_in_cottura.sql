-- Modulo 120 — Nuovo stato ordine IN_COTTURA (macchina a stati flussi operativi)
--
-- Il flusso reale del locale prevede uno step intermedio tra "in preparazione" e "pronto":
-- il pizzaiolo mette la pizza IN FORNO (stato IN_COTTURA), poi il Bancone chiude il giro.
-- Prima esisteva solo IN_PREPARAZIONE -> PRONTO (il tasto "In forno" saltava dritto a PRONTO).
--
-- ATTENZIONE: ALTER TYPE ... ADD VALUE deve essere committato PRIMA di poter essere usato.
-- Per questo l'aggiornamento della matrice transizioni sta nel modulo 121 (separato).
-- Idempotente: IF NOT EXISTS.

ALTER TYPE core.stato_ordine ADD VALUE IF NOT EXISTS 'IN_COTTURA' BEFORE 'PRONTO';
