-- Modulo 88 — Roadmap di priorità + nota su pubblicità comparativa (vs Trancio)
--
-- Origine: handoff sessione Claude mobile (mod 60). Solo INSERT su note_marketing (nessun
-- riferimento a tenant/profiles/schema, non serve riscrittura). Dipende dal modulo 78
-- (tabella note_marketing). Additivo, idempotente, nessun DROP/DELETE.

insert into public.note_marketing (categoria, titolo, contenuto, priorita, stato) values
(
  'go_to_market',
  'Roadmap di priorità concordata (agosto 2026)',
  '1) Verificare schema reale (profiles/tenants) con Claude Code — sblocca tutto il resto. 2) Applicare mod 51-52 (documenti, firma, noleggio) e testare su Francy Pizza. 3) Completare moduli_catalogo con la roadmap reale, configurare SMTP e chiave Anthropic, attivare l''agente e testare l''isolamento dati tra tenant. 4) Decidere su Trancio, scrivere contenuti reali di FAQ/landing/prezzi, completare il rendering pubblico. 5) Ads, n8n, provider di pagamento a rate — solo dopo che 1-4 sono solidi.',
  'alta', 'approvata'
),
(
  'posizionamento',
  'Nominare Trancio nella landing di confronto: valutare prima di pubblicare',
  'La pubblicità comparativa che nomina un concorrente è legale in Italia/UE (D.Lgs. 145/2007, direttiva 2006/114/CE) solo se il confronto è oggettivo, verificabile, non denigratorio e non genera confusione tra i marchi. Un confronto fattuale sulle funzionalità (assenza di cassa/magazzino/contabilità in Trancio) è difendibile, ma resta un rischio di contestazione. La landing vs-trancio resta NON pubblicata finché non si decide: valutare se nominare il concorrente esplicitamente o riformulare in modo generico ("gestionali focalizzati solo su prenotazioni e sala").',
  'media', 'da_valutare'
);
