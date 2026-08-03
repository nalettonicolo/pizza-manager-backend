-- Matrice minima ruoli × tenant × azioni (accettazione sicurezza)
-- Usare con JWT reali su staging. Atteso: allow / deny come da colonna.

-- Legenda: SA=superadmin, AD=admin/owner tenant, OP=operatore/cassa/…, CL=cliente, AN=anon

-- | Azione                              | SA | AD | OP | CL | AN | Note |
-- |-------------------------------------|----|----|----|----|----|------|
-- | Leggere ordini tenant A             | Y* | Y  | Y  | N  | N  | *solo in supporto con override esplicito |
-- | Leggere ordini tenant B (da A)      | Y* | N  | N  | N  | N  | leakage |
-- | upsert_support_presence su tenant X | N† | Y‡ | Y‡ | Y‡ | N  | †SA non scrive; ‡solo proprio tenant da auth.uid() |
-- | sa_list_support_presence            | Y  | N  | N  | N  | N  | |
-- | sa_get/upsert go_live_checklist     | Y  | N  | N  | N  | N  | |
-- | create_order_with_items             | N§ | Y  | Y  | Y‖ | N  | §salvo flusso QA; ‖canale web del proprio tenant |
-- | Menu pubblico per dominio           | -  | -  | -  | Y  | Y  | solo prodotti del tenant del host |
-- | Archivio password / HR docs         | Y  | Y  | N  | N  | N  | storage privato |

-- Smoke SQL correlati:
--   sql/scripts/smoke_rls_cross_tenant.sql
--   sql/tests/30_support_presence_asserts.sql

SELECT 'vedi commenti in testa al file' AS matrice_ruoli_tenant;
