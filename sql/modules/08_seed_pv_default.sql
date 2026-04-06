

-- =============================================================================
-- 8) Seed: un punto vendita predefinito per tenant senza sedi (multi-PV / cassa)
-- =============================================================================

INSERT INTO core.punti_vendita (tenant_id, nome, slug, attivo)
SELECT t.id, 'Sede principale', 'principale', true
FROM core.tenants t
WHERE NOT EXISTS (SELECT 1 FROM core.punti_vendita pv WHERE pv.tenant_id = t.id);

