-- Modulo 90 — Promemoria: riconciliare contenuti con linee guida di stile esistenti
--
-- Origine: handoff sessione Claude mobile (mod 62). Solo INSERT su note_marketing.
-- Dipende dal modulo 78 (tabella note_marketing). Additivo, idempotente, nessun DROP/DELETE.

insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'messaggistica',
  'Confrontare i testi scritti in chat con le linee guida di stile già esistenti',
  'Nicolò ha già delle linee guida proprie (tono di voce, terminologia, eventuali policy di stile) non condivise in questa sessione. Prima di pubblicare qualsiasi contenuto generato in chat (le 8 landing page dei moduli nel modulo 89, Guida Utente, Guida Superadmin), va fatto un confronto con quelle linee guida esistenti per verificare coerenza, terminologia e tono. Da fare appena si apre una sessione con Claude Code/accesso ai file reali, dove le linee guida esistenti sono disponibili.',
  'alta', 'da_valutare'
);
